import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { WagmiProvider, createConfig, http } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RainbowKitProvider, getDefaultConfig, darkTheme } from '@rainbow-me/rainbowkit'
import '@rainbow-me/rainbowkit/styles.css'
import './index.css'
import App from './App'
import { arcTestnet } from './config/chains'
import { ThemeProvider } from './context/ThemeContext'

// Create wagmi config with RainbowKit defaults
const config = getDefaultConfig({
  appName: 'AAM Human Dashboard',
  projectId: 'aam-dashboard', // WalletConnect project ID (use placeholder for local dev)
  chains: [arcTestnet],
  transports: {
    [arcTestnet.id]: http(),
  },
})

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme()}>
          <ThemeProvider>
            <App />
          </ThemeProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
)
