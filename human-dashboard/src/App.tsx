import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useWatchContractEvent } from 'wagmi'
import { useQueryClient } from '@tanstack/react-query'
import { formatUnits, parseUnits, isAddress, getAddress } from 'viem'
import { useState, useEffect, useMemo, useCallback } from 'react'
import { AAM_ADDRESS, USDC_ADDRESS, AAM_ABI, ERC20_ABI } from './config/contracts'
import { useTheme } from './context/ThemeContext'
import { ThemeSwitcher } from './components/ThemeSwitcher'

const STATUS_LABELS = ['None', 'Active', 'Paused', 'Revoked']

// View mode types for lookup feature
type ViewMode = 'wallet' | 'lookup'

// Custom hook to manage lookup mode state
function useLookupMode() {
  const [viewMode, setViewMode] = useState<ViewMode>('wallet')
  const [lookupAddress, setLookupAddress] = useState<string>('')
  const [lookupInput, setLookupInput] = useState<string>('')

  // Parse URL params on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const addr = params.get('addr')
    if (addr && isAddress(addr)) {
      const normalized = getAddress(addr)
      setLookupAddress(normalized)
      setLookupInput(normalized)
      setViewMode('lookup')
    }
  }, [])

  // Update URL when lookup address changes
  const setLookup = useCallback((addr: string) => {
    if (isAddress(addr)) {
      const normalized = getAddress(addr)
      setLookupAddress(normalized)
      setViewMode('lookup')
      // Update URL without page reload
      const url = new URL(window.location.href)
      url.searchParams.set('addr', normalized)
      window.history.pushState({}, '', url.toString())
    }
  }, [])

  // Clear lookup mode and return to wallet
  const clearLookup = useCallback(() => {
    setLookupAddress('')
    setLookupInput('')
    setViewMode('wallet')
    // Remove addr param from URL
    const url = new URL(window.location.href)
    url.searchParams.delete('addr')
    window.history.pushState({}, '', url.toString())
  }, [])

  return {
    viewMode,
    lookupAddress,
    lookupInput,
    setLookupInput,
    setLookup,
    clearLookup,
    isReadOnly: viewMode === 'lookup',
  }
}

function formatUSDC(value: bigint | undefined): string {
  if (value === undefined) return '—'
  return `$${Number(formatUnits(value, 6)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatPeriod(seconds: bigint | undefined): string {
  if (!seconds || seconds === 0n) return '—'
  const s = Number(seconds)
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  if (s < 604800) return `${Math.floor(s / 86400)}d`
  return `${Math.floor(s / 604800)}w`
}

function shortenAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

// Types for agent tree
interface AgentNode {
  address: string
  level: number
  children: AgentNode[]
}

// Hook to build dynamic agent tree from on-chain data
function useAgentTree(rootAddress: string | undefined) {
  // Level 0: Get direct children of root (connected wallet)
  const { data: level1Children, isLoading: l1Loading } = useReadContract({
    address: AAM_ADDRESS,
    abi: AAM_ABI,
    functionName: 'getChildren',
    args: rootAddress ? [rootAddress as `0x${string}`] : undefined,
    query: { 
      enabled: !!rootAddress,
      refetchInterval: 30000,
    },
  })

  // Level 1: Get children of each level 1 child
  const level2Calls = useMemo(() => 
    (level1Children || []).map((child) => ({
      address: AAM_ADDRESS,
      abi: AAM_ABI,
      functionName: 'getChildren' as const,
      args: [child] as const,
    })),
    [level1Children]
  )

  const { data: level2Results, isLoading: l2Loading } = useReadContracts({
    contracts: level2Calls,
    query: { 
      enabled: level2Calls.length > 0,
      refetchInterval: 30000,
    },
  })

  // Build tree structure
  const tree: AgentNode[] = useMemo(() => 
    (level1Children || []).map((childAddr, i) => {
      const grandchildren = level2Results?.[i]?.result as string[] | undefined
      return {
        address: childAddr,
        level: 1,
        children: (grandchildren || []).map((gcAddr) => ({
          address: gcAddr,
          level: 2,
          children: [], // Stop at 2 levels to prevent infinite loops
        })),
      }
    }),
    [level1Children, level2Results]
  )

  return {
    tree,
    isLoading: l1Loading || l2Loading,
    isEmpty: !l1Loading && (!level1Children || level1Children.length === 0),
  }
}

// Dynamic Allowance Card - fetches allowance for any parent/child pair
function DynamicAllowanceCard({ 
  childAddress, 
  parentAddress,
  level,
  readOnly = false,
}: { 
  childAddress: string
  parentAddress: string
  level: number
  readOnly?: boolean
}) {
  const { theme } = useTheme()
  const queryClient = useQueryClient()
  
  // Write hooks for actions
  const { writeContract: pauseWrite, data: pauseHash, isPending: isPausing } = useWriteContract()
  const { writeContract: unpauseWrite, data: unpauseHash, isPending: isUnpausing } = useWriteContract()
  const { writeContract: revokeWrite, data: revokeHash, isPending: isRevoking } = useWriteContract()
  
  // Wait for receipts
  const { isLoading: isPauseConfirming, isSuccess: pauseSuccess, isError: pauseError } = 
    useWaitForTransactionReceipt({ hash: pauseHash })
  const { isLoading: isUnpauseConfirming, isSuccess: unpauseSuccess, isError: unpauseError } = 
    useWaitForTransactionReceipt({ hash: unpauseHash })
  const { isLoading: isRevokeConfirming, isSuccess: revokeSuccess, isError: revokeError } = 
    useWaitForTransactionReceipt({ hash: revokeHash })
  
  // Combined loading state - disable all buttons if any action pending
  const isAnyActionPending = isPausing || isUnpausing || isRevoking || 
    isPauseConfirming || isUnpauseConfirming || isRevokeConfirming
  
  // Combined error state
  const actionError = pauseError || unpauseError || revokeError
  
  // Invalidate queries on any success
  useEffect(() => {
    if (pauseSuccess || unpauseSuccess || revokeSuccess) {
      queryClient.invalidateQueries()
    }
  }, [pauseSuccess, unpauseSuccess, revokeSuccess, queryClient])
  
  // Action handlers
  const handlePause = () => {
    pauseWrite({
      address: AAM_ADDRESS,
      abi: AAM_ABI,
      functionName: 'pause',
      args: [childAddress as `0x${string}`],
    })
  }
  
  const handleUnpause = () => {
    unpauseWrite({
      address: AAM_ADDRESS,
      abi: AAM_ABI,
      functionName: 'unpause',
      args: [childAddress as `0x${string}`],
    })
  }
  
  const handleRevoke = () => {
    revokeWrite({
      address: AAM_ADDRESS,
      abi: AAM_ABI,
      functionName: 'revoke',
      args: [childAddress as `0x${string}`],
    })
  }
  
  const { data: allowance, isLoading } = useReadContract({
    address: AAM_ADDRESS,
    abi: AAM_ABI,
    functionName: 'getAllowance',
    args: [parentAddress as `0x${string}`, childAddress as `0x${string}`],
    query: { refetchInterval: 30000 },
  })

  const { data: available } = useReadContract({
    address: AAM_ADDRESS,
    abi: AAM_ABI,
    functionName: 'getAvailable',
    args: [parentAddress as `0x${string}`, childAddress as `0x${string}`],
    query: { refetchInterval: 30000 },
  })

  if (isLoading) {
    return (
      <div className={`${theme.colors.bgCard} rounded-lg p-4 sm:p-6 border ${theme.colors.border} animate-pulse`}>
        <div className={`h-4 ${theme.colors.bgMain} rounded w-1/2 mb-2`}></div>
        <div className={`h-3 ${theme.colors.bgMain} rounded w-1/3`}></div>
      </div>
    )
  }

  if (!allowance || allowance[6] === 0) return null // No allowance or None status

  const [, aType, limit, period, spent, , status] = allowance
  const statusLabel = STATUS_LABELS[status] || 'Unknown'
  const statusColors = [theme.colors.textMuted, theme.colors.success, theme.colors.warning, theme.colors.error]
  const statusColor = statusColors[status] || theme.colors.textSecondary

  const levelEmoji = level === 1 ? '🤖' : '⚙️'

  return (
    <div className={`${theme.colors.bgCard} rounded-lg p-4 sm:p-6 border ${theme.colors.border} relative`}>
      {/* Connection line */}
      <div className={`absolute -left-4 top-5 w-3 h-px ${theme.colors.border.replace('border-', 'bg-')}`} />
      
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{levelEmoji}</span>
          <div>
            <h3 className={`font-semibold ${theme.colors.textPrimary}`}>Agent</h3>
            <p className={`text-xs ${theme.colors.textSecondary} font-mono`}>{shortenAddress(childAddress)}</p>
          </div>
        </div>
        <span className={`text-sm font-medium ${statusColor} ${status === 3 ? 'line-through' : ''}`}>{statusLabel}</span>
      </div>
      
      {/* Type Badge */}
      <div className="mb-3">
        {aType === 0 ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
            🔄 CAP
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
            💧 STREAM
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className={theme.colors.textSecondary}>{aType === 0 ? 'Limit' : 'Total'}</p>
          <p className={`${theme.colors.textPrimary} font-medium`}>
            {formatUSDC(limit)} {aType === 0 ? '/' : 'over'} {formatPeriod(period)}
          </p>
        </div>
        <div>
          <p className={theme.colors.textSecondary}>Spent</p>
          <p className={`${theme.colors.textPrimary} font-medium`}>{formatUSDC(spent)}</p>
        </div>
        <div>
          <p className={theme.colors.textSecondary}>Available</p>
          <p className={`${theme.colors.success} font-medium`}>{formatUSDC(available)}</p>
        </div>
        <div>
          <p className={theme.colors.textSecondary}>{aType === 0 ? 'Resets' : 'Drips'}</p>
          <p className={theme.colors.textPrimary}>{aType === 0 ? 'Periodic' : 'Continuous'}</p>
        </div>
      </div>

      {/* Action Buttons - Outline style (hidden in read-only mode) */}
      {status !== 3 && !readOnly && (
        <div className={`flex flex-wrap gap-2 mt-3 pt-3 border-t ${theme.colors.border}`}>
          {status === 1 && (
            <>
              <button
                onClick={handlePause}
                disabled={isAnyActionPending}
                className={`min-h-[44px] px-4 py-2 rounded border text-sm font-medium transition-colors active:scale-95 active:opacity-80 ${
                  isAnyActionPending 
                    ? 'border-gray-600 text-gray-500 cursor-not-allowed'
                    : 'border-yellow-500 text-yellow-500 hover:bg-yellow-500/10'
                }`}
              >
                {isPausing || isPauseConfirming ? '⏳ Pausing...' : '⏸️ Pause'}
              </button>
              <button
                onClick={handleRevoke}
                disabled={isAnyActionPending}
                className={`min-h-[44px] px-4 py-2 rounded border text-sm font-medium transition-colors active:scale-95 active:opacity-80 ${
                  isAnyActionPending 
                    ? 'border-gray-600 text-gray-500 cursor-not-allowed'
                    : 'border-red-500 text-red-500 hover:bg-red-500/10'
                }`}
              >
                {isRevoking || isRevokeConfirming ? '⏳ Revoking...' : '🚫 Revoke'}
              </button>
            </>
          )}
          {status === 2 && (
            <>
              <button
                onClick={handleUnpause}
                disabled={isAnyActionPending}
                className={`min-h-[44px] px-4 py-2 rounded border text-sm font-medium transition-colors active:scale-95 active:opacity-80 ${
                  isAnyActionPending 
                    ? 'border-gray-600 text-gray-500 cursor-not-allowed'
                    : 'border-emerald-500 text-emerald-500 hover:bg-emerald-500/10'
                }`}
              >
                {isUnpausing || isUnpauseConfirming ? '⏳ Unpausing...' : '▶️ Unpause'}
              </button>
              <button
                onClick={handleRevoke}
                disabled={isAnyActionPending}
                className={`min-h-[44px] px-4 py-2 rounded border text-sm font-medium transition-colors active:scale-95 active:opacity-80 ${
                  isAnyActionPending 
                    ? 'border-gray-600 text-gray-500 cursor-not-allowed'
                    : 'border-red-500 text-red-500 hover:bg-red-500/10'
                }`}
              >
                {isRevoking || isRevokeConfirming ? '⏳ Revoking...' : '🚫 Revoke'}
              </button>
            </>
          )}
        </div>
      )}

      {/* Error Display */}
      {actionError && (
        <p className={`${theme.colors.error} text-sm mt-2`}>
          ✗ Transaction failed
        </p>
      )}
    </div>
  )
}

// Agent Tree View - dynamically built from on-chain data
function AgentTreeView({ userAddress, readOnly = false }: { userAddress: string; readOnly?: boolean }) {
  const { theme } = useTheme()
  const { tree, isLoading, isEmpty } = useAgentTree(userAddress)
  const queryClient = useQueryClient()

  // Watch for AllowanceCreated events to trigger immediate refresh
  useWatchContractEvent({
    address: AAM_ADDRESS,
    abi: AAM_ABI,
    eventName: 'AllowanceCreated',
    onLogs() {
      queryClient.invalidateQueries()
    },
  })

  if (isLoading) {
    return (
      <div className={`${theme.colors.bgCard} rounded-lg p-4 sm:p-6 border ${theme.colors.border}`}>
        <h2 className={`text-xl font-bold ${theme.colors.textPrimary} flex items-center gap-2 mb-4`}>
          🌳 Your Agent Hierarchy
        </h2>
        <div className="animate-pulse space-y-4">
          <div className={`h-16 ${theme.colors.bgMain} rounded`}></div>
          <div className={`h-20 ${theme.colors.bgMain} rounded ml-6`}></div>
          <div className={`h-20 ${theme.colors.bgMain} rounded ml-6`}></div>
        </div>
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className={`${theme.colors.bgCard} rounded-lg p-4 sm:p-6 border ${theme.colors.border} text-center`}>
        <span className="text-4xl mb-4 block">🌱</span>
        <h3 className={`font-semibold ${theme.colors.textPrimary} mb-2`}>No Allowances Yet</h3>
        <p className={`${theme.colors.textSecondary} text-sm`}>
          Create your first allowance using the form on the left
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className={`text-xl font-bold ${theme.colors.textPrimary} flex items-center gap-2`}>
        🌳 {readOnly ? 'Agent Hierarchy' : 'Your Agent Hierarchy'}
      </h2>
      
      {/* Root node (connected wallet or viewed address) */}
      <div className={`${theme.colors.bgCard} rounded-lg p-4 sm:p-6 border ${theme.colors.borderAccent}`}>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{readOnly ? '🔍' : '👤'}</span>
          <div>
            <h3 className={`font-semibold ${theme.colors.textPrimary}`}>{readOnly ? 'Viewing' : 'You (Root)'}</h3>
            <p className={`text-xs ${theme.colors.textSecondary} font-mono`}>{shortenAddress(userAddress)}</p>
          </div>
        </div>
      </div>

      {/* Children */}
      <div className="space-y-3 ml-6">
        {tree.map((agent) => (
          <div key={agent.address}>
            <DynamicAllowanceCard 
              childAddress={agent.address} 
              parentAddress={userAddress} 
              level={1}
              readOnly={readOnly}
            />
            {/* Grandchildren */}
            {agent.children.length > 0 && (
              <div className="space-y-3 ml-6 mt-3">
                {agent.children.map((grandchild) => (
                  <DynamicAllowanceCard
                    key={grandchild.address}
                    childAddress={grandchild.address}
                    parentAddress={agent.address}
                    level={2}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Deposit Form Component with granular button states
function DepositForm({ userAddress }: { userAddress: string }) {
  const { theme } = useTheme()
  const [amount, setAmount] = useState('')
  const queryClient = useQueryClient()
  
  const { data: usdcBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [userAddress as `0x${string}`],
    query: { refetchInterval: 30000 },
  })

  const { data: usdcAllowance } = useReadContract({
    address: USDC_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [userAddress as `0x${string}`, AAM_ADDRESS],
    query: { refetchInterval: 30000 },
  })

  const { writeContract: approve, data: approveHash, isPending: isApproving } = useWriteContract()
  const { writeContract: deposit, data: depositHash, isPending: isDepositing } = useWriteContract()
  
  const { isLoading: isApproveConfirming, isSuccess: approveIsSuccess } = useWaitForTransactionReceipt({ hash: approveHash })
  const { isLoading: isDepositConfirming, isSuccess: depositIsSuccess } = useWaitForTransactionReceipt({ hash: depositHash })

  const parsedAmount = amount ? parseUnits(amount, 6) : 0n
  
  // Validation states
  const hasAmount = parsedAmount > 0n
  const hasEnoughBalance = usdcBalance !== undefined && parsedAmount <= usdcBalance
  const hasEnoughAllowance = usdcAllowance !== undefined && parsedAmount <= usdcAllowance

  // Determine button state
  type ButtonState = 'enter-amount' | 'insufficient-balance' | 'needs-approval' | 'ready' | 'pending'
  let buttonState: ButtonState
  if (isApproving || isApproveConfirming || isDepositing || isDepositConfirming) {
    buttonState = 'pending'
  } else if (!hasAmount) {
    buttonState = 'enter-amount'
  } else if (!hasEnoughBalance) {
    buttonState = 'insufficient-balance'
  } else if (!hasEnoughAllowance) {
    buttonState = 'needs-approval'
  } else {
    buttonState = 'ready'
  }

  // Invalidate queries after successful transactions
  useEffect(() => {
    if (approveIsSuccess) {
      queryClient.invalidateQueries()
    }
  }, [approveIsSuccess, queryClient])

  useEffect(() => {
    if (depositIsSuccess) {
      queryClient.invalidateQueries()
      setAmount('')
    }
  }, [depositIsSuccess, queryClient])

  const handleApprove = () => {
    approve({
      address: USDC_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [AAM_ADDRESS, parsedAmount],
    })
  }

  const handleDeposit = () => {
    deposit({
      address: AAM_ADDRESS,
      abi: AAM_ABI,
      functionName: 'deposit',
      args: [parsedAmount],
    })
  }

  // Button rendering based on state
  const renderButton = () => {
    switch (buttonState) {
      case 'pending':
        if (isApproving || isApproveConfirming) {
          return (
            <button disabled className={`w-full min-h-[44px] py-2 ${theme.colors.buttonDisabled} rounded-lg font-medium`}>
              Approving...
            </button>
          )
        }
        return (
          <button disabled className={`w-full min-h-[44px] py-2 ${theme.colors.buttonDisabled} rounded-lg font-medium`}>
            Depositing...
          </button>
        )
      case 'enter-amount':
        return (
          <button disabled className={`w-full min-h-[44px] py-2 ${theme.colors.buttonDisabled} rounded-lg font-medium`}>
            Enter Amount
          </button>
        )
      case 'insufficient-balance':
        return (
          <button disabled className={`w-full min-h-[44px] py-2 ${theme.colors.buttonDisabled} rounded-lg font-medium`}>
            Insufficient Balance
          </button>
        )
      case 'needs-approval':
        return (
          <button
            onClick={handleApprove}
            className={`w-full min-h-[44px] py-2 ${theme.colors.buttonWarning} rounded-lg font-medium transition-colors active:scale-95 active:opacity-80`}
          >
            Approve USDC
          </button>
        )
      case 'ready':
        return (
          <button
            onClick={handleDeposit}
            className={`w-full min-h-[44px] py-2 ${theme.colors.buttonPrimary} rounded-lg font-medium transition-colors active:scale-95 active:opacity-80`}
          >
            Deposit
          </button>
        )
    }
  }

  return (
    <div className={`${theme.colors.bgCard} rounded-lg p-4 sm:p-6 border ${theme.colors.border}`}>
      <h3 className={`font-semibold ${theme.colors.textPrimary} mb-3`}>💰 Deposit USDC</h3>
      
      <div className="space-y-3">
        <div>
          <label className={`text-sm ${theme.colors.textSecondary}`}>Wallet Balance</label>
          <p className={`${theme.colors.textPrimary} font-medium`}>{formatUSDC(usdcBalance)}</p>
        </div>
        
        <div>
          <label className={`text-sm ${theme.colors.textSecondary}`}>Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="100.00"
            className={`w-full mt-1 px-3 py-2 text-base ${theme.colors.inputBg} border ${theme.colors.inputBorder} rounded-lg ${theme.colors.textPrimary} placeholder-${theme.colors.textMuted.replace('text-', '')} ${theme.colors.inputFocus} focus:outline-none`}
          />
        </div>

        {buttonState === 'insufficient-balance' && (
          <p className={`${theme.colors.error} text-sm`}>Insufficient USDC balance</p>
        )}

        {renderButton()}

        {depositIsSuccess && (
          <p className={`${theme.colors.success} text-sm`}>✓ Deposit complete!</p>
        )}
      </div>
    </div>
  )
}

// Withdraw Form Component
function WithdrawForm({ userAddress }: { userAddress: string }) {
  const { theme } = useTheme()
  const [amount, setAmount] = useState('')
  const queryClient = useQueryClient()
  
  const { data: poolBalance } = useReadContract({
    address: AAM_ADDRESS,
    abi: AAM_ABI,
    functionName: 'balanceOf',
    args: [userAddress as `0x${string}`],
    query: { refetchInterval: 30000 },
  })

  const { writeContract, data: hash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  const parsedAmount = amount ? parseUnits(amount, 6) : 0n
  const hasAmount = parsedAmount > 0n
  const hasEnoughBalance = poolBalance !== undefined && parsedAmount <= poolBalance

  // Invalidate queries after successful withdrawal
  useEffect(() => {
    if (isSuccess) {
      queryClient.invalidateQueries()
      setAmount('')
    }
  }, [isSuccess, queryClient])

  const handleWithdraw = () => {
    writeContract({
      address: AAM_ADDRESS,
      abi: AAM_ABI,
      functionName: 'withdraw',
      args: [parsedAmount],
    })
  }

  const renderButton = () => {
    if (isPending || isConfirming) {
      return (
        <button disabled className={`w-full min-h-[44px] py-2 ${theme.colors.buttonDisabled} rounded-lg font-medium`}>
          Withdrawing...
        </button>
      )
    }
    if (!hasAmount) {
      return (
        <button disabled className={`w-full min-h-[44px] py-2 ${theme.colors.buttonDisabled} rounded-lg font-medium`}>
          Enter Amount
        </button>
      )
    }
    if (!hasEnoughBalance) {
      return (
        <button disabled className={`w-full min-h-[44px] py-2 ${theme.colors.buttonDisabled} rounded-lg font-medium`}>
          Insufficient Pool Balance
        </button>
      )
    }
    return (
      <button
        onClick={handleWithdraw}
        className={`w-full min-h-[44px] py-2 ${theme.colors.buttonSecondary} rounded-lg font-medium transition-colors active:scale-95 active:opacity-80`}
      >
        Withdraw
      </button>
    )
  }

  return (
    <div className={`${theme.colors.bgCard} rounded-lg p-4 sm:p-6 border ${theme.colors.border}`}>
      <h3 className={`font-semibold ${theme.colors.textPrimary} mb-3`}>💸 Withdraw USDC</h3>
      
      <div className="space-y-3">
        <div>
          <label className={`text-sm ${theme.colors.textSecondary}`}>Pool Balance</label>
          <p className={`${theme.colors.textPrimary} font-medium`}>{formatUSDC(poolBalance)}</p>
        </div>
        
        <div>
          <label className={`text-sm ${theme.colors.textSecondary}`}>Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="100.00"
            className={`w-full mt-1 px-3 py-2 text-base ${theme.colors.inputBg} border ${theme.colors.inputBorder} rounded-lg ${theme.colors.textPrimary} placeholder-${theme.colors.textMuted.replace('text-', '')} ${theme.colors.inputFocus} focus:outline-none`}
          />
        </div>

        {hasAmount && !hasEnoughBalance && (
          <p className={`${theme.colors.error} text-sm`}>Insufficient pool balance</p>
        )}

        {renderButton()}

        {isSuccess && (
          <p className={`${theme.colors.success} text-sm`}>✓ Withdrawal complete!</p>
        )}
      </div>
    </div>
  )
}

// Create Allowance Form
function CreateAllowanceForm({ userAddress }: { userAddress: string }) {
  const { theme } = useTheme()
  const [child, setChild] = useState('')
  const [limit, setLimit] = useState('')
  const [period, setPeriod] = useState('86400') // Default 1 day
  const queryClient = useQueryClient()

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract()
  const { isLoading: isConfirming, isSuccess, error: txError } = useWaitForTransactionReceipt({ hash })

  // Invalidate queries after successful creation
  useEffect(() => {
    if (isSuccess) {
      queryClient.invalidateQueries()
      setChild('')
      setLimit('')
    }
  }, [isSuccess, queryClient])

  const handleCreate = () => {
    const trimmedChild = child.trim()
    if (!isAddress(trimmedChild)) {
      console.error('Invalid address:', trimmedChild)
      return
    }
    const normalizedChild = getAddress(trimmedChild)
    console.log('Creating allowance:', { child: normalizedChild, limit, period })
    writeContract({
      address: AAM_ADDRESS,
      abi: AAM_ABI,
      functionName: 'createAllowance',
      args: [
        normalizedChild,
        0, // CAP type
        parseUnits(limit, 6),
        BigInt(period),
      ],
    }, {
      onError: (err) => console.error('Write error:', err),
      onSuccess: (data) => console.log('Write success:', data),
    })
  }
  
  const isValidAddress = child.trim() === '' || isAddress(child.trim())

  const error = writeError || txError

  return (
    <div className={`${theme.colors.bgCard} rounded-lg p-4 sm:p-6 border ${theme.colors.border}`}>
      <h3 className={`font-semibold ${theme.colors.textPrimary} mb-3`}>➕ Create Allowance</h3>
      
      <div className="space-y-3">
        <div>
          <label className={`text-sm ${theme.colors.textSecondary}`}>Child Agent Address</label>
          <input
            type="text"
            value={child}
            onChange={(e) => setChild(e.target.value)}
            placeholder="0x..."
            className={`w-full mt-1 px-3 py-2 text-base ${theme.colors.inputBg} border ${!isValidAddress ? 'border-red-500' : theme.colors.inputBorder} rounded-lg ${theme.colors.textPrimary} placeholder-${theme.colors.textMuted.replace('text-', '')} ${theme.colors.inputFocus} focus:outline-none font-mono`}
          />
          {!isValidAddress && (
            <p className={`${theme.colors.error} text-xs mt-1`}>Invalid address format</p>
          )}
        </div>

        <div>
          <label className={`text-sm ${theme.colors.textSecondary}`}>Limit (USDC)</label>
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(e.target.value)}
            placeholder="100.00"
            className={`w-full mt-1 px-3 py-2 text-base ${theme.colors.inputBg} border ${theme.colors.inputBorder} rounded-lg ${theme.colors.textPrimary} placeholder-${theme.colors.textMuted.replace('text-', '')} ${theme.colors.inputFocus} focus:outline-none`}
          />
        </div>

        <div>
          <label className={`text-sm ${theme.colors.textSecondary}`}>Period</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className={`w-full mt-1 px-3 py-2 text-base min-h-[44px] ${theme.colors.inputBg} border ${theme.colors.inputBorder} rounded-lg ${theme.colors.textPrimary} ${theme.colors.inputFocus} focus:outline-none`}
          >
            <option value="3600">1 Hour</option>
            <option value="86400">1 Day</option>
            <option value="604800">1 Week</option>
            <option value="2592000">30 Days</option>
          </select>
        </div>

        <button
          onClick={handleCreate}
          disabled={isPending || isConfirming || !child || !limit || !isValidAddress}
          className={`w-full min-h-[44px] py-2 ${isPending || isConfirming || !child || !limit || !isValidAddress ? theme.colors.buttonDisabled : theme.colors.buttonPrimary} rounded-lg font-medium transition-colors active:scale-95 active:opacity-80`}
        >
          {isPending || isConfirming ? 'Creating...' : 'Create Allowance'}
        </button>

        {isSuccess && (
          <p className={`${theme.colors.success} text-sm`}>✓ Allowance created!</p>
        )}

        {error && (
          <p className={`${theme.colors.error} text-sm`}>
            ✗ Error: {error.message?.slice(0, 100) || 'Transaction failed'}
          </p>
        )}
      </div>
    </div>
  )
}

// Lookup Input Component
function LookupInput({ 
  value, 
  onChange, 
  onSubmit, 
  onClear, 
  isActive 
}: { 
  value: string
  onChange: (v: string) => void
  onSubmit: () => void
  onClear: () => void
  isActive: boolean
}) {
  const { theme } = useTheme()
  const isValidInput = value.trim() === '' || isAddress(value.trim())

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isValidInput && value.trim()) {
      onSubmit()
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
      <div className="relative flex-1 sm:flex-none">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="View wallet: 0x..."
          className={`w-full sm:w-48 lg:w-64 px-3 py-1.5 text-base ${theme.colors.inputBg} border ${
            !isValidInput ? 'border-red-500' : theme.colors.inputBorder
          } rounded-lg ${theme.colors.textPrimary} placeholder-gray-500 focus:outline-none ${theme.colors.inputFocus} font-mono`}
        />
      </div>
      <button
        onClick={onSubmit}
        disabled={!isValidInput || !value.trim()}
        className={`min-h-[44px] px-4 py-2 text-sm rounded-lg font-medium transition-colors active:scale-95 active:opacity-80 ${
          !isValidInput || !value.trim()
            ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 text-white'
        }`}
      >
        🔍
      </button>
      {isActive && (
        <button
          onClick={onClear}
          className="min-h-[44px] px-4 py-2 text-sm rounded-lg font-medium bg-gray-600 hover:bg-gray-700 active:scale-95 active:opacity-80 text-white transition-colors"
        >
          ✕ Clear
        </button>
      )}
    </div>
  )
}

// Read-Only Banner Component
function ReadOnlyBanner({ address, onClear }: { address: string; onClear: () => void }) {
  const { theme } = useTheme()
  
  return (
    <div className={`${theme.colors.bgCard} border-b ${theme.colors.border} py-2`}>
      <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 sm:gap-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="text-xl">🔍</span>
          <span className={`text-sm ${theme.colors.textSecondary}`}>
            Viewing <span className="font-mono text-blue-400">{shortenAddress(address)}</span>
          </span>
          <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-400 rounded-full font-medium">
            Read Only
          </span>
        </div>
        <button
          onClick={onClear}
          className="min-h-[44px] px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors active:scale-95 active:opacity-80"
        >
          ← Return to your wallet
        </button>
      </div>
    </div>
  )
}

// Main App Component
function App() {
  const { theme } = useTheme()
  const { address, isConnected } = useAccount()
  const lookup = useLookupMode()

  // Determine which address to use for display
  const displayAddress = lookup.isReadOnly ? lookup.lookupAddress : address

  const { data: poolBalance } = useReadContract({
    address: AAM_ADDRESS,
    abi: AAM_ABI,
    functionName: 'balanceOf',
    args: displayAddress ? [displayAddress as `0x${string}`] : undefined,
    query: { 
      enabled: !!displayAddress,
      refetchInterval: 30000,
    },
  })

  // Handle lookup submission
  const handleLookupSubmit = () => {
    if (lookup.lookupInput.trim() && isAddress(lookup.lookupInput.trim())) {
      lookup.setLookup(lookup.lookupInput.trim())
    }
  }

  // Check if we should show content (either connected wallet mode or lookup mode with valid address)
  const shouldShowContent = lookup.isReadOnly ? !!lookup.lookupAddress : isConnected

  return (
    <div className={`min-h-screen ${theme.colors.bgMain} ${theme.colors.textPrimary}`}>
      {/* Header */}
      <header className={`border-b ${theme.colors.border} ${theme.colors.bgMain}/80 backdrop-blur sticky top-0 z-50`}>
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-2 sm:gap-4">
          <div className="w-full sm:w-auto text-center sm:text-left">
            <h1 className="font-bold text-lg">AAM Dashboard</h1>
            <p className={`text-xs ${theme.colors.textSecondary}`}>Agent Allowance Manager</p>
          </div>
          <div className="flex flex-wrap items-center justify-center sm:justify-end gap-2 sm:gap-4">
            {/* Lookup Input */}
            <LookupInput
              value={lookup.lookupInput}
              onChange={lookup.setLookupInput}
              onSubmit={handleLookupSubmit}
              onClear={lookup.clearLookup}
              isActive={lookup.isReadOnly}
            />
            <ThemeSwitcher />
            <ConnectButton />
          </div>
        </div>
      </header>

      {/* Read-Only Banner */}
      {lookup.isReadOnly && (
        <ReadOnlyBanner address={lookup.lookupAddress} onClear={lookup.clearLookup} />
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {!shouldShowContent ? (
          <div className="text-center py-20">
            <span className="text-6xl mb-4 block">🔗</span>
            <h2 className="text-2xl font-bold mb-2">Connect Your Wallet</h2>
            <p className={`${theme.colors.textSecondary} mb-6`}>Connect to view and manage agent allowances</p>
            <p className={`${theme.colors.textMuted} text-sm mb-4`}>— or —</p>
            <p className={`${theme.colors.textSecondary} mb-6`}>Enter any wallet address above to view their agent hierarchy</p>
            <ConnectButton />
          </div>
        ) : lookup.isReadOnly ? (
          /* Read-Only View - Only show tree, no forms */
          <div className="max-w-4xl mx-auto">
            {/* Pool Balance Card (read-only) */}
            <div className={`bg-gradient-to-br ${theme.colors.gradientCard} rounded-lg p-4 sm:p-6 border ${theme.colors.borderAccent} mb-8`}>
              <h2 className={`text-sm ${theme.colors.textSecondary} mb-1`}>Pool Balance</h2>
              <p className={`text-3xl font-bold ${theme.colors.textPrimary}`}>{formatUSDC(poolBalance)}</p>
              <p className={`text-xs ${theme.colors.textSecondary} mt-2 font-mono`}>{lookup.lookupAddress}</p>
            </div>

            {/* Agent Tree (read-only) */}
            <AgentTreeView userAddress={lookup.lookupAddress} readOnly={true} />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-8">
            {/* Left Column: Pool Balance + Forms */}
            <div className="space-y-6">
              {/* Pool Balance Card */}
              <div className={`bg-gradient-to-br ${theme.colors.gradientCard} rounded-lg p-4 sm:p-6 border ${theme.colors.borderAccent}`}>
                <h2 className={`text-sm ${theme.colors.textSecondary} mb-1`}>Your Pool Balance</h2>
                <p className={`text-3xl font-bold ${theme.colors.textPrimary}`}>{formatUSDC(poolBalance)}</p>
                <p className={`text-xs ${theme.colors.textSecondary} mt-2 font-mono`}>{shortenAddress(address || '')}</p>
              </div>

              {/* Deposit Form */}
              <DepositForm userAddress={address!} />

              {/* Withdraw Form */}
              <WithdrawForm userAddress={address!} />

              {/* Create Allowance Form */}
              <CreateAllowanceForm userAddress={address!} />
            </div>

            {/* Right Column: Agent Tree */}
            <div className="lg:col-span-2">
              <AgentTreeView userAddress={address!} />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className={`border-t ${theme.colors.border} py-4 mt-auto pb-[env(safe-area-inset-bottom)]`}>
        <div className={`max-w-6xl mx-auto px-4 text-center text-sm ${theme.colors.textMuted}`}>
          <p>AAM Contract: <span className="font-mono">{shortenAddress(AAM_ADDRESS)}</span></p>
          <p className="mt-1">Deployed on Arc Testnet • IPFS-Ready • ✓ Fully Decentralized</p>
        </div>
      </footer>
    </div>
  )
}

export default App
