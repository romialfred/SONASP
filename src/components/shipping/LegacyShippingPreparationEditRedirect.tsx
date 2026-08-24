import { Navigate, useParams } from 'react-router-dom';
import { legacyShippingPreparationEditDestination } from '@/lib/shippingRoutes';

export function LegacyShippingPreparationEditRedirect() {
  const { id } = useParams<{ id: string }>();

  return <Navigate to={legacyShippingPreparationEditDestination(id)} replace />;
}
