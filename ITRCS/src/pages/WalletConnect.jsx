import { useState } from 'react';
import { Button } from '@arco-design/web-react';
import { useWallet } from '@suiet/wallet-kit';
import { ConnectButton } from '@suiet/wallet-kit';

import '../styles/WalletConnect.less';

const WalletConnect = ({ nextStep }) => {
  const { connected, account, disconnect, provider } = useWallet();

  // 截断地址显示
  const truncatedAddress = () => {
    if (!account?.address) return '';
    const len = account.address.length;
    return len > 10 ? `${account.address.slice(0, 6)}...${account.address.slice(-4)}` : account.address;
  };



  // 处理继续按钮点击
  const handleContinueClick = () => {
    if(nextStep) {
      nextStep();
    }
  };

  // 处理断开连接
  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

  return (
    <div className="wallet-connect-container">
      <div className="wallet-connect-header">
        <h2>Connect Your Wallet</h2>
        <p className="subtitle">Connect your wallet to continue</p>
      </div>
      <div className="wallet-connect-content">
        <div className="wallet-icon-container">
          <div className="wallet-icon">
            <div className="icon-inner">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
        
        {/* <div className="wallet-title">连接区块链钱包</div> */}
        {/* <div className="wallet-subtitle">连接您的数字钱包以继续支付流程</div> */}

        {!connected ? (
          <div className="wallet-list">
            <ConnectButton className="wallet-item-btn" hideIcon={true} />
          </div>
        ) : (
          <div className="wallet-info">
            <div className="wallet-info-header">
              <span className="wallet-name">
                {provider?.name || 'Sui Wallet'}
              </span>
            </div>
            <div className="wallet-address-container">
              <span className="wallet-address">{truncatedAddress()}</span>
            </div>
            <div className='btn-group'>
              <Button 
                onClick={handleDisconnect} 
                type="default"
                className="btn btn-primary"
              >
                Disconnect
              </Button>
              <Button
                type="primary"
                onClick={handleContinueClick}
                className="btn btn-back"
              >
                Continue
              </Button>
            </div>
            
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletConnect;