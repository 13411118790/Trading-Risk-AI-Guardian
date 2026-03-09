import { useState } from 'react';
import { Steps } from '@arco-design/web-react';
import '../styles/AppLayout.less';
import { WalletProvider } from '@suiet/wallet-kit'
import '@suiet/wallet-kit/style.css';
import Logo from '../assets/Logo.png';

// 导入步骤对应的组件
// 注意：这些组件需要后续创建或适配
import WalletConnect from '../pages/WalletConnect';
import AppWrapper from '../pages/AppWrapper';
import RiskAssessmentForm from '../pages/RiskAssessmentForm';
import Risk from '../pages/Risk';

const AppLayout = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const steps = [
    {
      title: 'Connect Wallet',
      description: 'Completed'
    },
    {
      title: 'Select Merchant',
      description: ''
    },
    {
      title: 'Payment Info',
      description: ''
    },
    {
      title: 'Risk Results',
      description: ''
    }
  ];

  // 根据当前步骤返回对应的组件
  const getCurrentComponent = () => {
    switch(currentStep) {
      case 1:
        return <WalletConnect nextStep={nextStep} />;
      case 2:
        return <AppWrapper nextStep={nextStep} prevStep={prevStep} />;
      case 3:
        return <RiskAssessmentForm nextStep={nextStep} prevStep={prevStep} />;
      case 4:
        return <Risk prevStep={prevStep} handleContinue={handleContinue}  />;
      default:
        return <WalletConnect nextStep={nextStep}/>;
    }
  };

  // 前进到下一步
  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  // 返回上一步
  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleContinue = () => {
    setCurrentStep(2);
  };

  return (
    <div className="app-layout">
      {/* 头部导航栏 */}
      <header className="main-header">
        <div className="header-content">
          <div className="logo">
            <img src={Logo} alt="ITRCS Logo" className="logo-icon" />
            <span className="logo-text">Trading Risk AI Guardian</span>
          </div>
          <nav className="header-nav">
            <a href="/merchant-upload" className="nav-link">
              Merchant Upload
            </a>
          </nav>
        </div>
      </header>

      {/* 流程指示器 */}
      <div className="process-indicator">
        <Steps
          current={currentStep}
          direction="horizontal"
          type="default"
          labelPlacement="vertical"
          size="large"
        >
          {steps.map((step, index) => (
            <Steps.Step
              key={index+1}
              title={step.title}
            />
          ))}
        </Steps>
      </div>

      {/* 主内容区域 */}
      <main className="main-content">
        <div className="content-placeholder">
          <div className="placeholder-text">
            <WalletProvider>
              {getCurrentComponent()}
            </WalletProvider>
          </div>
        </div>
      </main>

      {/* 底部版权信息 */}
      <footer className="main-footer">
        <div className="footer-content">
          <p>© 2026 Chain Payment Demo System | For Demo Use Only</p>
        </div>
      </footer>
    </div>
  );
};

export default AppLayout;