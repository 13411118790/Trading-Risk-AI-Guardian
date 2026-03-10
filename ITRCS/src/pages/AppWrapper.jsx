import { useState, useEffect } from 'react';
import { Button } from '@arco-design/web-react';
import { useWallet } from '@suiet/wallet-kit';
import { getAllMerchantInfo } from '../utils/contractUtils';
import '../styles/AppWrapper.less';

const AppWrapper = ({ nextStep, prevStep }) => {
  const wallet = useWallet();
  
  // 选中的商户索引
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  // 商户列表数据
  const [merchants, setMerchants] = useState([]);
  // 加载状态
  const [loading, setLoading] = useState(true);
  // 错误状态
  const [error, setError] = useState(null);

  // 从合约获取商户列表
  useEffect(() => {
    const loadMerchants = async () => {
      setLoading(true);
      setError(null);
      try {
        const merchantData = await getAllMerchantInfo(wallet);
        
        setMerchants(merchantData);
        // 如果有商户数据，默认选中第一个
        if (merchantData.length > 0) {
          setSelectedMerchant(0);
        }
      } catch (err) {
        console.error('Failed to get merchant list:', err);
        setError('Failed to get merchant list, please try again later');
      } finally {
        setLoading(false);
      }
    };

    // 只有在钱包连接且地址存在时才加载商户列表
    if (wallet?.connected && wallet?.address) {
      loadMerchants();
    } else {
      // 钱包未连接时清空数据
      setMerchants([]);
      setSelectedMerchant(null);
      setLoading(false);
    }
  }, [wallet?.connected, wallet?.address]); // 只依赖具体的状态值而不是整个对象

  // 选择商户
  const selectMerchant = (index) => {
    setSelectedMerchant(index);
  };

  // 处理继续按钮点击事件
  const handleContinue = () => {
    // 商户已选择，可以继续
    if (selectedMerchant !== null && selectedMerchant !== undefined) {
      // 将选中的商户信息存入 localStorage
      const selectedMerchantInfo = merchants[selectedMerchant];
      localStorage.setItem('selectedMerchant', JSON.stringify(selectedMerchantInfo));
      nextStep && nextStep();
    }
  };

  // 处理返回按钮点击事件
  const handleBack = () => {
    prevStep && prevStep();
  };

  return (
    <div className="app-wrapper">
      {/* 标题栏 */}
      <div className="merchant-header">
        <h3 className="merchant-title">Select Merchant</h3>
        <p className="merchant-subtitle">Please select the merchant to pay</p>
      </div>
      
      {/* 加载状态 */}
      {loading && (
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading merchant list...</p>
        </div>
      )}
      
      {/* 错误状态 */}
      {error && (
        <div className="error-container">
          <p className="error-message">{error}</p>
          <Button 
            type="primary" 
            onClick={() => {
              setSelectedMerchant(null);
              setMerchants([]);
              setLoading(true);
                getAllMerchantInfo(wallet).then(merchantData => {
                  setMerchants(merchantData);
                  if (merchantData.length > 0) {
                    setSelectedMerchant(0);
                  }
                }).catch(err => {
                  console.error('Retry failed to get merchant list:', err);
                  setError('Failed to get merchant list, please try again later');
                }).finally(() => {
                  setLoading(false);
                });
            }}
          >
            Retry
          </Button>
        </div>
      )}
      
      {/* 商户选择列表 */}
      {!loading && !error && (
        <div className="merchant-selection">
          {merchants.length > 0 ? (
            <div className="merchant-list">
              {merchants.map((merchant, index) => (
                <div 
                  key={index}
                  className={`merchant-item ${selectedMerchant === index ? 'selected' : ''}`}
                  onClick={() => selectMerchant(index)}
                >
                  <div className="merchant-icon">{merchant.icon}</div>
                  <div className="merchant-info">
                    <h3 className="merchant-name">{merchant.name}</h3>
                    <p className="merchant-desc">{merchant.description}</p>
                  </div>
                  {selectedMerchant === index && (
                    <div className="merchant-check">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="10" fill="#3686FF"/>
                        <path d="M7 10L9 12L13 8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-container">
              <p>No available merchants</p>
            </div>
          )}
        </div>
      )}
      
      {/* 底部按钮 */}
      <div className="action-buttons">
        <Button 
          className="btn btn-back" 
          onClick={handleBack}
          type="default"
        >
          Back
        </Button>
        <Button 
          className="btn btn-primary" 
          onClick={handleContinue}
          type="primary"
        >
          Continue
        </Button>
      </div>
    </div>
  );
};

export default AppWrapper;
