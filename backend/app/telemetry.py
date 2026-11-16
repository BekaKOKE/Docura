"""OpenTelemetry: traces, metrics and logs, exported over OTLP when OTEL_EXPORTER_OTLP_ENDPOINT is set.

Without an endpoint nothing is exported, so tests and a plain `uvicorn` run stay quiet. The business metrics below are
the application-specific ones the dashboard and the alerts are built on.
"""

import logging
import os

from fastapi import FastAPI
from opentelemetry import metrics, trace
from opentelemetry._logs import set_logger_provider
from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
from opentelemetry.exporter.otlp.proto.http.metric_exporter import OTLPMetricExporter
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk._logs import LoggerProvider, LoggingHandler
from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import PeriodicExportingMetricReader
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

_meter = metrics.get_meter("docura")

registrations = _meter.create_counter("docura.registrations", description="Accounts registered")
logins = _meter.create_counter("docura.logins", description="Login attempts, by outcome (success|failure)")
companies_created = _meter.create_counter("docura.companies.created", description="Companies created")
rate_limited = _meter.create_counter("docura.rate_limited", description="Auth requests refused by the rate limiter")
api_errors = _meter.create_counter("docura.api.errors", description="Domain errors returned, by code")

_configured = False


def setup_telemetry(app: FastAPI, environment: str) -> bool:
    """Wire providers and instrument the app. Returns whether an exporter was configured."""
    global _configured
    endpoint = os.environ.get("OTEL_EXPORTER_OTLP_ENDPOINT")
    if not endpoint or _configured:
        return False
    _configured = True
    resource = Resource.create(
        {
            "service.name": os.environ.get("OTEL_SERVICE_NAME", "docura-backend"),
            "deployment.environment": environment,
        }
    )

    tracer_provider = TracerProvider(resource=resource)
    tracer_provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    trace.set_tracer_provider(tracer_provider)

    reader = PeriodicExportingMetricReader(OTLPMetricExporter(), export_interval_millis=5000)
    metrics.set_meter_provider(MeterProvider(resource=resource, metric_readers=[reader]))

    logger_provider = LoggerProvider(resource=resource)
    logger_provider.add_log_record_processor(BatchLogRecordProcessor(OTLPLogExporter()))
    set_logger_provider(logger_provider)
    logging.getLogger().addHandler(LoggingHandler(level=logging.INFO, logger_provider=logger_provider))
    logging.getLogger().setLevel(logging.INFO)

    FastAPIInstrumentor.instrument_app(app, excluded_urls="api/health")
    return True
