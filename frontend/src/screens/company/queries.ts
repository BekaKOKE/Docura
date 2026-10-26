import { useQuery } from '@tanstack/react-query'
import { services } from '../../services'

export const companyKey = ['company'] as const
export const logoKey = ['company', 'logo'] as const

export const useCompany = () => useQuery({ queryKey: companyKey, queryFn: () => services.company.get() })
export const useLogoUrl = () => useQuery({ queryKey: logoKey, queryFn: () => services.company.logoUrl() })
