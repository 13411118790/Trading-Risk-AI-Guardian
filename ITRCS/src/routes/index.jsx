import { createBrowserRouter } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import MerchantUpload from '../pages/MerchantUpload';

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
  },
  {
    path: '/merchant-upload',
    element: <MerchantUpload />,
  }
]);

export default router;