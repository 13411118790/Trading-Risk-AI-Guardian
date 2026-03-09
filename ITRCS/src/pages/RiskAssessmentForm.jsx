import { useState, useEffect } from 'react';
import { Button } from '@arco-design/web-react';
import '../styles/RiskAssessmentForm.less';

const RiskAssessmentForm = ({ nextStep, prevStep }) => {
  // 表单数据状态管理
  const [formData, setFormData] = useState({
    merchantName: '全球电商平台',
    paymentAddress: '',
    amount: '0.5',
    note: ''
  });

  // 生成随机地址
  const generateRandomAddress = () => {
    const chars = '0123456789abcdef';
    let address = '0x';
    for (let i = 0; i < 40; i++) {
      address += chars[Math.floor(Math.random() * chars.length)];
    }
    setFormData(prev => ({
      ...prev,
      paymentAddress: address
    }));
  };

  // 组件挂载时设置默认地址和商户名称
  useEffect(() => {
    // 设置默认地址
    setFormData(prev => ({
      ...prev,
      paymentAddress: '0x71C7656EC7ab88b098def751B7401B5F6d8976F'
    }));
    
    // 尝试从localStorage获取商户名称
    try {
      const savedMerchant = localStorage.getItem('selectedMerchant');
      if (savedMerchant) {
        const merchantData = JSON.parse(savedMerchant);
        if (merchantData && merchantData.name) {
          setFormData(prev => ({
            ...prev,
            merchantName: merchantData.name
          }));
        }
      }
    } catch (error) {
      console.error('Failed to parse merchant information:', error);
      // 如果解析失败，保持默认值
    }
  }, []);

  // 处理输入变化
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 提交表单处理风险检查
  const handleSubmit = () => {
    // 表单验证
    if (!formData.paymentAddress || !formData.amount) {
      alert('Please complete the payment information');
      return;
    }
    
    try {
      // 将用户输入的付款信息存入 localStorage
      localStorage.setItem('paymentInfo', JSON.stringify({
        paymentAddress: formData.paymentAddress,
        amount: formData.amount,
        note: formData.note
      }));
    } catch (error) {
      console.error('Failed to save payment information:', error);
    }
    
    // 继续到风险检查步骤
    if (nextStep) {
      nextStep();
    }
  };

  // 返回上一步
  const handleBack = () => {
    if (prevStep) {
      prevStep();
    }
  };

  return (
    <div className="payment-form">
      {/* 标题栏 */}
      <div className="payment-header">
        <h1 className="payment-title">Payment Information</h1>
        <p className="payment-subtitle">Please enter payment address and amount</p>
      </div>
      
      {/* 付款表单 */}
      <div className="form-container">
        <div className="form-group">
          <label className="form-label">Payee Merchant</label>
          <input 
            type="text" 
            className="form-input" 
            name="merchantName"
            value={formData.merchantName}
            onChange={handleInputChange}
            placeholder="Merchant name" 
            readOnly
          />
        </div>
        
        <div className="form-group">
          <label className="form-label">Payment Address</label>
          <div className="address-input-container">
            <input 
              type="text" 
              className="form-input" 
              name="paymentAddress"
              value={formData.paymentAddress}
              onChange={handleInputChange}
              placeholder="Enter payment address"
            />
            <button 
              className="random-generate-btn" 
              onClick={generateRandomAddress}
            >
              Random Generate
            </button>
          </div>
        </div>
        
        <div className="form-group">
          <label className="form-label">Payment Amount(Sui)</label>
          <div className="amount-input-container">
            <input 
              type="text" 
              className="form-input" 
              name="amount"
              value={formData.amount}
              onChange={handleInputChange}
              placeholder="Enter amount"
            />
            <span className="currency-label">Sui</span>
          </div>
        </div>
        
        <div className="form-group">
          <label className="form-label">Product Information(Optional)</label>
          <input 
            type="text" 
            className="form-input" 
            name="note"
            value={formData.note}
            onChange={handleInputChange}
            placeholder="Enter product information"
          />
        </div>
      </div>
      
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
          onClick={handleSubmit}
          type="primary"
        >
          Check Risk
        </Button>
      </div>
    </div>
  );
};

export default RiskAssessmentForm;