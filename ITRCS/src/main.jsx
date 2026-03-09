import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { WalletProvider } from '@suiet/wallet-kit'
import '@arco-design/web-react/dist/css/arco.css'
import '@suiet/wallet-kit/style.css'
import './index.css'
import router from './routes'

createRoot(document.getElementById('root')).render(
  <WalletProvider>
    <div style={{ height: '100vh' }}>
      <RouterProvider router={router} />
    </div>
  </WalletProvider>,
)
