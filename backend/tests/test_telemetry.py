from opentelemetry.sdk.metrics import MeterProvider
from opentelemetry.sdk.metrics.export import InMemoryMetricReader

from app import telemetry
from app.config import Settings
from app.main import create_app


def test_setup_is_a_noop_without_an_exporter_endpoint(monkeypatch):
    monkeypatch.delenv("OTEL_EXPORTER_OTLP_ENDPOINT", raising=False)
    assert telemetry.setup_telemetry(create_app(Settings()), "development") is False


def test_business_counters_record_attributes():
    reader = InMemoryMetricReader()
    meter = MeterProvider(metric_readers=[reader]).get_meter("test")
    counter = meter.create_counter("docura.logins")
    counter.add(1, {"outcome": "failure"})
    data = reader.get_metrics_data()
    point = data.resource_metrics[0].scope_metrics[0].metrics[0].data.data_points[0]
    assert point.value == 1
    assert dict(point.attributes) == {"outcome": "failure"}


def test_app_env_defaults_to_development():
    assert Settings().app_env == "development"
