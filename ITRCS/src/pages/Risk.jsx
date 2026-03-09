import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import MarkdownIt from 'markdown-it';
import { fetchMerchantTransactions, fetchMerchantRiskReport, recordMerchantReport } from '../utils/contractUtils';
import { useWallet } from '@suiet/wallet-kit';
import { getContent, uploadContent } from '../utils/walrusUtils';
import { riskAssessmentPrompt } from '../utils/riskPrompt';
import '../styles/Risk.less';


const Risk = ({ prevStep, handleContinue }) => {
  const walletData = useWallet();
  
  // 使用useMemo缓存wallet对象，避免重复构造
  const wallet = useMemo(() => {
    if (!walletData?.connected || !walletData?.address && !walletData?.account?.address) {
      return null;
    }
    
    return {
      connected: walletData.connected,
      address: walletData.address || walletData.account?.address || null,
      signAndExecuteTransaction: walletData.signAndExecuteTransaction
    };
  }, [walletData]);
  
  // 状态管理
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [riskData, setRiskData] = useState(null);
  const [markdownContent, setMarkdownContent] = useState('');
  const [riskLevel, setRiskLevel] = useState(null); // 初始为null，等待API返回
  const detailsRef = useRef(null);
  
  // 新增状态：商户数据和交易信息
  const [merchantData, setMerchantData] = useState(null);
  const [transactionsData, setTransactionsData] = useState([]);
  const [riskReportData, setRiskReportData] = useState(null);
  const [loadingMerchantData, setLoadingMerchantData] = useState(false);
  const [merchantDataError, setMerchantDataError] = useState(null);
  
  // 从本地存储获取数据
  const [paymentInfo, setPaymentInfo] = useState({
    paymentAddress: '',
    amount: '',
    timestamp: ''
  });
  
  const [selectedMerchant, setSelectedMerchant] = useState({
    name: '',
    description: ''
  });
  
  // 初始化 markdown 渲染器
  const md = useMemo(() => new MarkdownIt(), []);
  
  // 根据风险等级返回相应的风险信息
  const riskInfo = {
    low: {
      title: 'Low Risk Transaction',
      description: 'This transaction has low risk and can be conducted safely'
    },
    medium: {
      title: 'Medium Risk Transaction',
      description: 'This transaction has certain risks, proceed with caution'
    },
    high: {
      title: 'High Risk Transaction',
      description: 'This transaction has high risk and is not recommended'
    }
  };
  
  // 获取风险数据的函数
  const fetchRiskData = async (text) => {
    try {
      setApiLoading(true);
      setApiError('');
      
      // 从本地存储获取API密钥
      const apiKey = 'a55e7a94-5377-4a91-b26b-e463a43d57c3';
      
      // 使用代理地址调用 AWS API
      const completionResponse = await axios.post(
        '/api/nova/v1/chat/completions',
        {
          "model": "nova-2-lite-v1",
          "messages": [  
            {
              "role": "system",
              "content": riskAssessmentPrompt
            },
            {
              "role": "user",
              "content": text
            }
          ],
          "temperature": 0.7,
          "max_tokens": 2000,
          "stream": false,
          // "reasoning_effort": "high" // 启用深度推理以获得更准确的风险评估
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      // 存储返回的风险数据
      setRiskData(completionResponse.data);
      
      // 获取AI返回的markdown内容
      if (completionResponse.data && completionResponse.data.choices && 
          completionResponse.data.choices[0] && completionResponse.data.choices[0].message) {
        const content = completionResponse.data.choices[0].message.content;
        setMarkdownContent(content);
        
        // 根据返回的风险等级更新显示 - 使用更精确的匹配逻辑
        const contentLower = content.toLowerCase();
        
        // 检查高风险关键词 - 优先检查完整短语
        if (contentLower.includes('high risk') || 
            contentLower.includes('high-risk') ||
            contentLower.includes('critical') ||
            (contentLower.includes('high') && !contentLower.includes('medium') && !contentLower.includes('low'))) {
          setRiskLevel('high');
        }
        // 检查中风险关键词
        else if (contentLower.includes('medium risk') || 
                 contentLower.includes('medium-risk') ||
                 contentLower.includes('moderate') ||
                 contentLower.includes('caution') ||
                 (contentLower.includes('medium') && !contentLower.includes('high') && !contentLower.includes('low'))) {
          setRiskLevel('medium');
        }
        // 检查低风险关键词
        else if (contentLower.includes('low risk') || 
                 contentLower.includes('low-risk') ||
                 contentLower.includes('safe') ||
                 contentLower.includes('minimal') ||
                 (contentLower.includes('low') && !contentLower.includes('high') && !contentLower.includes('medium'))) {
          setRiskLevel('low');
        }
        // 默认设为低风险
        else {
          setRiskLevel('low');
        }
        
        // 将AI返回的报告内容上传到IPFS
        try {
          const reportBlobId = await uploadContent(content, wallet, 'risk-report.md');
          let selectedMerchant = JSON.parse(localStorage.getItem('selectedMerchant'));
          // 调用recordMerchantReport合约方法
          if (selectedMerchant && selectedMerchant.blobId) {
            await recordMerchantReport(
              selectedMerchant.blobId,
              reportBlobId,
              wallet
            );
            
            // 更新状态显示合约调用成功
            setApiError(''); // 清除之前的错误信息
          } else {
            console.warn('No merchant selected or merchant blobId does not exist, cannot call recordMerchantReport');
          }
        } catch (uploadError) {
          console.error('Failed to upload risk report to IPFS or call contract:', uploadError);
          // 不影响页面显示，但记录错误
          setApiError(prev => prev ? `${prev}; Report upload failed: ${uploadError.message}` : `Report upload failed: ${uploadError.message}`);
        }
      } else {
        console.warn('API returned data format is abnormal:', completionResponse.data);
        setApiError('API returned data format is abnormal, please try again later');
      }
      
    } catch (error) {
      console.error('API call failed:', error);
      // 处理不同类型的错误
      let errorMessage = 'API call failed, please try again later';
      
      if (error.response) {
        // 服务器返回错误状态码
        if (error.response.status === 401) {
          errorMessage = 'Invalid API key. Please check your Nova API key.';
        } else if (error.response.status === 429) {
          errorMessage = 'Rate limit exceeded. Please try again later.';
        } else if (error.response.status === 404) {
          errorMessage = 'Model not found. Please check the model ID.';
        } else if (error.response.data && error.response.data.error) {
          errorMessage = error.response.data.error.message || errorMessage;
        }
      } else if (error.message.includes('Nova API key is not set')) {
        errorMessage = error.message;
      }
      
      setApiError(errorMessage);
    } finally {
      setApiLoading(false);
    }
  };
  
  // 生成整合的风险评估报告
  const generateIntegratedRiskReport = (merchantData, transactionFiles, riskReportFileData, paymentInfo, merchant) => {
    const currentTime = new Date().toLocaleString();
    
    // 解析商户数据
    let merchantInfo = {
      name: merchant?.name || '未知商户',
      businessType: '未知',
      scope: '未知',
      kycStatus: '未认证',
      supportedTokens: [],
      priceRange: '未知'
    };
    
    if (merchantData && merchantData.content) {
      try {
        let content = merchantData.content;
        
        // 如果content不是字符串，尝试安全地转换为字符串
        if (typeof content !== 'string') {
          try {
            content = JSON.stringify(content, (key, value) => {
              if (typeof value === 'object' && value !== null) {
                if (value.constructor === Object || Array.isArray(value)) {
                  return value;
                }
                // 过滤掉可能包含循环引用的对象
                return '[Object]';
              }
              return value;
            });
          } catch (stringifyError) {
              console.warn('Failed to serialize merchant data content, using toString:', stringifyError);
              content = String(content);
            }
        }
        // 简单解析商户信息（实际应该根据具体数据结构解析）
        if (content.includes('商户名称')) {
          const match = content.match(/商户名称[：:]\s*([^\n\r]+)/);
          if (match) merchantInfo.name = match[1].trim();
        }
        if (content.includes('业务类型')) {
          const match = content.match(/业务类型[：:]\s*([^\n\r]+)/);
          if (match) merchantInfo.businessType = match[1].trim();
        }
        if (content.includes('经营范围')) {
          const match = content.match(/经营范围[：:]\s*([^\n\r]+)/);
          if (match) merchantInfo.scope = match[1].trim();
        }
        if (content.includes('KYC认证状态')) {
          const match = content.match(/KYC认证状态[：:]\s*([^\n\r]+)/);
          if (match) merchantInfo.kycStatus = match[1].trim();
        }
      } catch (error) {
        console.error('Failed to parse merchant data:', error);
      }
    }
    
    // 解析交易数据
    let transactionStats = {
      totalCount: transactionFiles.length,
      totalAmount: 0,
      averageAmount: 0,
      maxAmount: 0,
      minAmount: Infinity,
      recentTransactions: []
    };
    
    transactionFiles.forEach(transaction => {
       if (transaction.fileData && transaction.fileData.content) {
         try {
           let content = transaction.fileData.content;
           
           // 如果content不是字符串，尝试安全地转换为字符串
           if (typeof content !== 'string') {
             try {
               content = JSON.stringify(content, (key, value) => {
                 if (typeof value === 'object' && value !== null) {
                   if (value.constructor === Object || Array.isArray(value)) {
                     return value;
                   }
                   // 过滤掉可能包含循环引用的对象
                   return '[Object]';
                 }
                 return value;
               });
             } catch (stringifyError) {
               console.warn('Failed to serialize transaction content, using toString:', stringifyError);
               content = String(content);
             }
           }
           
           // 提取金额信息
           const amountMatch = content.match(/交易金额[：:]\s*([^\n\r]+)/);
           if (amountMatch) {
             const amount = parseFloat(amountMatch[1].replace(/[^0-9.]/g, '')) || 0;
             transactionStats.totalAmount += amount;
             transactionStats.maxAmount = Math.max(transactionStats.maxAmount, amount);
             transactionStats.minAmount = Math.min(transactionStats.minAmount, amount);
           }
           
           // 保存最近交易信息
           if (transactionStats.recentTransactions.length < 3) {
             transactionStats.recentTransactions.push({
               hash: content.substring(0, 50) + '...',
               amount: amountMatch ? amountMatch[1] : 'Unknown',
               time: transaction.timestamp ? new Date(transaction.timestamp).toLocaleString() : 'Unknown'
             });
           }
         } catch (error) {
           console.error('Failed to parse transaction data:', error);
         }
       }
     });
    
    if (transactionStats.minAmount === Infinity) transactionStats.minAmount = 0;
    if (transactionStats.totalCount > 0) {
      transactionStats.averageAmount = transactionStats.totalAmount / transactionStats.totalCount;
    }
    
    // 解析风控报告数据
    let riskAnalysis = {
      riskLevel: 'Medium Risk',
      riskScore: 50,
      analysisDate: currentTime,
      recommendations: []
    };
    
    if (riskReportFileData && riskReportFileData.fileData && riskReportFileData.fileData.content) {
      try {
        let content = riskReportFileData.fileData.content;
        
        // 如果content不是字符串，尝试安全地转换为字符串
        if (typeof content !== 'string') {
          try {
            content = JSON.stringify(content, (key, value) => {
              if (typeof value === 'object' && value !== null) {
                if (value.constructor === Object || Array.isArray(value)) {
                  return value;
                }
                // 过滤掉可能包含循环引用的对象
                return '[Object]';
              }
              return value;
            });
          } catch (stringifyError) {
            console.warn('Failed to serialize risk report content, using toString:', stringifyError);
            content = String(content);
          }
        }
        
        if (content.includes('风险等级')) {
          const match = content.match(/风险等级[：:]\s*([^\n\r]+)/);
          if (match) riskAnalysis.riskLevel = match[1].trim();
        }
        if (content.includes('风险评分')) {
          const match = content.match(/风险评分[：:]\s*([^\n\r]+)/);
          if (match) riskAnalysis.riskScore = parseInt(match[1].replace(/[^0-9]/g, '')) || 50;
        }
        
        // 提取建议
        const recommendations = content.match(/建议[：:]\s*([^\n\r]+)/g);
        if (recommendations) {
          riskAnalysis.recommendations = recommendations.map(rec => rec.replace(/建议[：:]\s*/, ''));
        }
      } catch (error) {
        console.error('Failed to parse risk report:', error);
      }
    }    
    
    // 生成整合报告
    const integratedReport = `
    请使用英文回答我！！

### 综合风险评估报告
生成时间：${currentTime}

#### 一、当笔链上交易信息
#### 1. 基础交易信息：
- 发起钱包地址：${paymentInfo.paymentAddress || '0x7890a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e90'}（Sui链32字节地址格式）
- 接收钱包地址：${paymentInfo.receiverAddress || '0x1234567890a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c'}（Sui链32字节地址格式）
- 交易时间戳：${Math.floor(Date.now() / 1000)}
- 交易代币类型：${'Sui （合约：0x2d4f6a8c0e1b3d5f7a9c1e3b5d7f9a2c4e6g8h0j2l4n6p8r0t2v4x6z8）'}（Sui链标准合约）
- 交易金额：${paymentInfo.amount || '1'} Sui
#### 2. 交易关联信息：
- 商品/服务名称：${paymentInfo.note || '游戏装备'}
- 商品/服务标注价值：${paymentInfo.amount || '550'} Sui
- 交易用途备注：${paymentInfo.note || '游戏内资源补充'}

### 二、上笔交易风控报告
${riskReportFileData && riskReportFileData.fileData && riskReportFileData.fileData.content && riskReportFileData.fileData.content.content 
  ? (typeof riskReportFileData.fileData.content.content === 'string' 
     ? riskReportFileData.fileData.content.content 
     : '风控报告数据格式异常')
  : '暂无风控报告数据'}

### 三、商户历史交易信息
#### 1. 最近30笔交易明细（按时间倒序，用于交易频率计算，简化录入）：
${transactionStats.recentTransactions && Array.isArray(transactionStats.recentTransactions) 
  ? transactionStats.recentTransactions.map((tx, index) => 
      `${index + 1}. 金额: ${tx.amount || '未知'}, 时间: ${tx.time || '未知'}`
    ).join('\n')
  : '暂无交易明细'}

#### 四、商户注册业务信息
#### 1. 商户基础信息：
- 商户名称：${merchantInfo.name}
- 业务类型：${merchantInfo.businessType}
- 经营范围：${merchantInfo.scope}
#### 2. 商户资质信息：
- KYC认证状态：${merchantInfo.kycStatus}
- 支持的交易代币列表：${merchantInfo.supportedTokens?.join('；') || 'Sui（Sui链合约：0x8a9b0c1d2e3f4a5b6c7d8e90a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b）；SUI（原生代币）；Sui（合约：0x2d4f6a8c0e1b3d5f7a9c1e3b5d7f9a2c4e6g8h0j2l4n6p8r0t2v4x6z8）'}
- 公示的客单价区间：${merchantInfo.priceRange || '200 Sui - 1000 Sui'}
#### 3. 自定义扩展字段：
- 特殊业务说明：${merchantInfo.specialBusiness || '无特殊业务说明'}
- 风控特殊要求：白名单地址：${merchantInfo.whitelistAddress || '无白名单地址'}
`;
    return integratedReport;
  };
  
  // 获取商户数据、交易信息和风控报告（并行获取）
  const fetchMerchantAndTransactionData = async (merchant, paymentInfoParam) => {
    if (!merchant || !merchant.blobId) {
      return;
    }
  
    try {
      setLoadingMerchantData(true);
      setMerchantDataError('');
      
      const merchantBlobId = merchant.blobId;
      
      // 并行执行三个任务：
      // 1. 通过IPFS获取商户文件内容
      // 2. 通过合约获取商户近30条交易信息的blob_id
      // 3. 通过合约获取商户风控报告的blob_id
      
      // 任务1：获取商户文件内容
      const merchantFilePromise = getContent(merchantBlobId);
      
      // 任务2：获取交易信息blob_id列表
      const transactionsPromise = fetchMerchantTransactions(merchantBlobId, wallet);
      
      // 任务3：获取风控报告
      const riskReportPromise = fetchMerchantRiskReport(merchantBlobId, wallet);
      
      // 等待所有任务完成
      const [merchantFileData, transactions, riskReport] = await Promise.all([
        merchantFilePromise,
        transactionsPromise,
        riskReportPromise
      ]);
      
      // 获取交易文件内容
      let transactionFiles = [];
      if (transactions.length > 0) {
        // 对transactions进行去重处理
        const uniqueTransactions = transactions.filter((transaction, index, self) => {
          return index === self.findIndex((t) => t.blobId === transaction.blobId);
        });
        
        const transactionPromises = uniqueTransactions.map(async (transaction) => {
          try {
            const transactionFileData = await getContent(transaction);            
            return {
              ...transaction,
              fileData: {
                content: transactionFileData,
                blobId: transaction.blobId,
                timestamp: Date.now(),
                metadata: {
                  size: transactionFileData.length,
                  type: 'transaction_data'
                }
              }
            };
          } catch (error) {
            console.error(`Failed to get transaction file, blobId: ${transaction.blobId}`, error);
            return {
              ...transaction,
              fileData: null,
              error: error.message
            };
          }
        });
  
        transactionFiles = await Promise.all(transactionPromises);
      }
      
      // 获取风控报告文件内容
      let riskReportFileData = null;
      if (riskReport && riskReport.blobId) {
        try {
          const riskReportContent = await getContent(riskReport.blobId);
          riskReportFileData = {
            ...riskReport,
            fileData: {
              content: riskReportContent,
              blobId: riskReport.blobId,
              timestamp: Date.now(),
              metadata: {
                size: riskReportContent.length,
                type: 'risk_report'
              }
            }
          };
        } catch (error) {
          console.error('Failed to get risk report file:', error);
          riskReportFileData = {
            ...riskReport,
            fileData: null,
            error: error.message
          };
        }
      }
      
      // 整合所有数据生成AI风险评估报告
      const integratedRiskReport = generateIntegratedRiskReport(
        merchantFileData, 
        transactionFiles, 
        riskReportFileData,
        paymentInfoParam || paymentInfo, // 优先使用传入的参数，否则使用状态中的值
        merchant
      );
      
      fetchRiskData(integratedRiskReport);
      // 更新markdown内容为整合后的报告
      // setMarkdownContent(integratedRiskReport);
      
      // 保存数据到state（用于可能的调试或其他用途）
      setMerchantData({
        content: merchantFileData,
        blobId: merchantBlobId,
        timestamp: Date.now(),
        metadata: {
          size: merchantFileData.length,
          type: 'merchant_data'
        }
      });
      setTransactionsData(transactionFiles);
      setRiskReportData(riskReportFileData);
      
    } catch (error) {
        console.error('Failed to fetch merchant data, transaction information and risk report:', error);
        setMerchantDataError(error.message || 'Failed to fetch merchant data');
      } finally {
      setLoadingMerchantData(false);
    }
  };

  // 页面初始化时调用API
  useEffect(() => {   
     // 从 localStorage 获取付款信息
     const storedPaymentInfo = localStorage.getItem('paymentInfo');
     const storedMerchant = localStorage.getItem('selectedMerchant');
     
     if (storedPaymentInfo) {
       const parsedPaymentInfo = JSON.parse(storedPaymentInfo);
       setPaymentInfo(parsedPaymentInfo);
       
       if (storedMerchant) {
         const merchant = JSON.parse(storedMerchant);
         setSelectedMerchant(merchant);      
         // 获取商户blob_id后，通过合约获取交易信息并下载文件
         // 直接传递解析后的paymentInfo，避免状态更新时序问题
         fetchMerchantAndTransactionData(merchant, parsedPaymentInfo);
       }
     } else if (storedMerchant) {
       const merchant = JSON.parse(storedMerchant);
       setSelectedMerchant(merchant);      
       // 即使没有paymentInfo，也要获取商户数据
       fetchMerchantAndTransactionData(merchant, null);
     }
     
   }, []);
  
  // 渲染 markdown 内容
  useEffect(() => {
    if (markdownContent && detailsRef.current) {
      try {
        const renderedHtml = md.render(markdownContent);
        detailsRef.current.innerHTML = renderedHtml;
        // 添加一些CSS样式来美化markdown渲染效果
        const styleElement = document.createElement('style');
        styleElement.textContent = `
          .details-content h1 { color: #333; font-size: 24px; margin-bottom: 16px; border-bottom: 2px solid #2196F3; padding-bottom: 8px; }
          .details-content h2 { color: #444; font-size: 20px; margin-top: 20px; margin-bottom: 12px; border-bottom: 1px solid #ddd; padding-bottom: 6px; }
          .details-content h3 { color: #fff; font-size: 18px; margin-top: 16px; margin-bottom: 10px; }
          .details-content h4 { color: #666; font-size: 16px; margin-top: 14px; margin-bottom: 8px; }
          .details-content p { line-height: 1.6; margin-bottom: 12px; color: #333; }
          .details-content ul, .details-content ol { margin-bottom: 12px; padding-left: 20px; }
          .details-content li { margin-bottom: 6px; line-height: 1.5; }
          .details-content strong { color: #2196F3; font-weight: 600; }
          .details-content blockquote { background: #f5f5f5; border-left: 4px solid #2196F3; padding: 12px; margin: 12px 0; font-style: italic; }
          .details-content code { background: #f0f0f0;color:#000; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; font-size: 14px; }
          .details-content pre { background: #f8f8f8; padding: 12px; border-radius: 6px; overflow-x: auto; margin: 12px 0; }
          .details-content pre code { background: none; padding: 0; }
          .details-content table { width: 100%; border-collapse: collapse; margin: 12px 0; }
          .details-content th, .details-content td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }
          .details-content th { background: #f5f5f5; font-weight: 600; }
        `;
        
        // 检查是否已经添加过样式，避免重复添加
        if (!document.getElementById('markdown-styles')) {
          styleElement.id = 'markdown-styles';
          document.head.appendChild(styleElement);
        }
      } catch (error) {
        console.error('Markdown rendering failed:', error);
        detailsRef.current.innerHTML = `<div style="color: red;">Content rendering failed: ${error.message}</div>`;
      }
    } else if (!markdownContent) {
      if (detailsRef.current) {
        detailsRef.current.innerHTML = '<div style="color: #666;">暂无风险详情内容</div>';
      }
    }
  }, [markdownContent, md, riskLevel, apiLoading, apiError]);
  
  // 处理重试按钮点击事件
  const handleRetry = async () => {
    try {
      // 重新获取商户和交易数据
      const storedMerchant = localStorage.getItem('selectedMerchant');
      if (storedMerchant) {
        const merchant = JSON.parse(storedMerchant);
        await fetchMerchantAndTransactionData(merchant);
      }
    } catch (error) {
      console.error('Retry failed:', error);
      setApiError('Retry failed, please refresh the page and try again');
    }
  };
  
  // 处理返回按钮点击事件
  const handleBackClick = () => {
    if (prevStep) {
      prevStep();
    }
  };
  
  // 处理继续按钮点击事件
  const handleContinueClick = () => {
    if (handleContinue) {
      handleContinue();
    }
  };
  
  return (
    <div className="risk-result">
      {/* 标题栏 */}
      <div className="risk-header">
        <h1 className="risk-title">Risk Assessment Results</h1>
        <p className="risk-subtitle">Transaction Risk Analysis and Recommendations</p>
      </div>
      <div className="risk-content">
         {/* 加载状态 */}
         {(apiLoading || (!apiError && !riskLevel)) && (
           <div className="loading-container">
             <div className="loading-spinner"></div>
             <p className="loading-text">Getting risk assessment data, please wait...</p>
           </div>
         )}
         
         {/* 错误状态 */}
         {apiError && (
           <div className="error-container">
             <div className="error-icon">⚠️</div>
             <p className="error-text">{apiError}</p>
             <button className="btn btn-primary" onClick={handleRetry}>Retry</button>
           </div>
         )}
        
        {/* 风险等级显示区 */}
        {!apiLoading && !apiError && riskLevel && (
          <div className="risk-level-section">
            <div className="risk-icon-container">
              <div className={`risk-icon ${riskLevel}-risk`}>
                <div className={`${riskLevel}-risk-inner`}></div>
                <div className={`${riskLevel}-risk-dot`}></div>
              </div>
            </div>
            <h2 className={`${riskLevel}-risk-title`}>{riskInfo[riskLevel].title}</h2>
            <p className={`${riskLevel}-risk-desc`}>{riskInfo[riskLevel].description}</p>
          </div>
        )}
        
        {/* 交易信息区域 */}
        {!apiLoading && !apiError && riskLevel && (
          <div className="transaction-info">
            <div className="section-header">
              <div className="info-icon"></div>
              <h3 className="section-title">Transaction Information</h3>
            </div>
            <div className="info-content">
              <div className="info-item">
                <span className="info-label">Payee Merchant</span>
                <span className="info-value">{selectedMerchant.name || 'Not Selected'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Payment Address</span>
                <span className="info-value">{paymentInfo.paymentAddress || 'Not Filled'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Payment Amount</span>
                <span className="info-value">{paymentInfo.amount || 'Not Filled'} Sui</span>
              </div>
              <div className="info-item">
                <span className="info-label">Transaction Time</span>
                <span className="info-value">{new Date().toLocaleString()}</span>
              </div>
            </div>
          </div>
        )}
        
        {/* 商户数据和交易信息加载状态 */}
        {loadingMerchantData && (
          <div className="merchant-data-loading">
            <div className="loading-spinner"></div>
            <p className="loading-text">Getting merchant data, transaction information and risk reports, generating comprehensive risk assessment...</p>
          </div>
        )}
        
        {/* 商户数据错误状态 */}
        {merchantDataError && (
          <div className="merchant-data-error">
            <div className="error-icon">⚠️</div>
            <p className="error-text">{merchantDataError}</p>
          </div>
        )}
        
        {/* AI生成的风险详情（markdown渲染） */}
        {!apiLoading && !apiError && riskLevel && (
          <div className="risk-details">
            <div className="section-header">
              <div className={`${riskLevel}-warning-icon`}></div>
              <h3 className="section-title">Risk Details</h3>
            </div>
            <div className="details-content" ref={detailsRef}>
              {!markdownContent ? (
                <div style={{ color: '#666', textAlign: 'center', padding: '20px' }}>
                  Generating risk assessment report...
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
      
      
      {/* 底部按钮 */}
      <div className="action-buttons">
        <button className="btn btn-back" onClick={handleBackClick}>Back to Edit</button>
        <button className="btn btn-primary" onClick={handleContinueClick}>Restart Demo</button>
      </div>
    </div>
  );
};

export default Risk;

// 新增的CSS样式
const additionalStyles = `
  .merchant-icon {
    width: 20px;
    height: 20px;
    background: linear-gradient(135deg, #2196F3, #1976D2);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 12px;
  }
  
  .transactions-icon {
    width: 20px;
    height: 20px;
    background: linear-gradient(135deg, #FF9800, #F57C00);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 12px;
  }
  
  .merchant-data-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    background: rgba(33, 150, 243, 0.05);
    border-radius: 12px;
    border: 1px solid rgba(33, 150, 243, 0.2);
    margin: 20px 0;
  }
  
  .merchant-data-error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    background: rgba(244, 67, 54, 0.05);
    border-radius: 12px;
    border: 1px solid rgba(244, 67, 54, 0.2);
    margin: 20px 0;
  }
  
  .merchant-data-section {
    background: rgba(33, 150, 243, 0.02);
    border-radius: 12px;
    padding: 20px;
    margin: 20px 0;
    border: 1px solid rgba(33, 150, 243, 0.1);
  }
  
  .merchant-data-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .data-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid rgba(33, 150, 243, 0.1);
  }
  
  .data-label {
    font-weight: 500;
    color: #666;
    font-size: 14px;
  }
  
  .data-value {
    font-weight: 600;
    color: #2196F3;
    font-size: 14px;
    word-break: break-all;
    max-width: 60%;
    text-align: right;
  }
  
  .merchant-file-preview {
    margin-top: 16px;
    padding: 16px;
    background: rgba(33, 150, 243, 0.05);
    border-radius: 8px;
    border: 1px solid rgba(33, 150, 243, 0.2);
  }
  
  .merchant-file-preview h4 {
    margin: 0 0 12px 0;
    color: #2196F3;
    font-size: 16px;
    font-weight: 600;
  }
  
  .file-content {
    background: #f8f9fa;
    padding: 12px;
    border-radius: 6px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.4;
    color: #333;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 200px;
    overflow-y: auto;
  }
  
  .transactions-data-section {
    background: rgba(255, 152, 0, 0.02);
    border-radius: 12px;
    padding: 20px;
    margin: 20px 0;
    border: 1px solid rgba(255, 152, 0, 0.1);
  }
  
  .transactions-data-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  .transactions-summary {
    display: flex;
    gap: 20px;
    padding: 12px;
    background: rgba(255, 152, 0, 0.05);
    border-radius: 8px;
    border: 1px solid rgba(255, 152, 0, 0.2);
  }
  
  .summary-item {
    font-weight: 600;
    color: #FF9800;
    font-size: 14px;
  }
  
  .transactions-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .transaction-item {
    background: white;
    border: 1px solid rgba(255, 152, 0, 0.2);
    border-radius: 8px;
    padding: 16px;
    transition: all 0.3s ease;
  }
  
  .transaction-item:hover {
    border-color: rgba(255, 152, 0, 0.4);
    box-shadow: 0 2px 8px rgba(255, 152, 0, 0.1);
  }
  
  .transaction-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 152, 0, 0.1);
  }
  
  .transaction-id {
    font-weight: 600;
    color: #FF9800;
    font-size: 14px;
  }
  
  .transaction-time {
    font-size: 12px;
    color: #666;
  }
  
  .transaction-details {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .detail-item {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  
  .detail-label {
    font-weight: 500;
    color: #666;
    font-size: 13px;
    min-width: 80px;
  }
  
  .detail-value {
    font-weight: 500;
    color: #333;
    font-size: 13px;
    word-break: break-all;
    flex: 1;
    text-align: right;
  }
  
  .transaction-file-preview {
    margin-top: 8px;
    padding: 8px;
    background: rgba(255, 152, 0, 0.05);
    border-radius: 6px;
    border: 1px solid rgba(255, 152, 0, 0.2);
  }
  
  .file-content-small {
    background: #f8f9fa;
    padding: 8px;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    font-size: 11px;
    line-height: 1.3;
    color: #333;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 100px;
    overflow-y: auto;
    margin-top: 4px;
  }
  
  .more-transactions {
    text-align: center;
    padding: 12px;
    color: #FF9800;
    font-weight: 500;
    font-size: 14px;
    background: rgba(255, 152, 0, 0.05);
    border-radius: 8px;
    border: 1px solid rgba(255, 152, 0, 0.2);
  }
  
  .risk-report-icon {
    width: 20px;
    height: 20px;
    background: linear-gradient(135deg, #9C27B0, #7B1FA2);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 12px;
  }
  
  .risk-report-section {
    background: rgba(156, 39, 176, 0.02);
    border-radius: 12px;
    padding: 20px;
    margin: 20px 0;
    border: 1px solid rgba(156, 39, 176, 0.1);
  }
  
  .risk-report-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  
  .risk-summary {
    background: rgba(156, 39, 176, 0.05);
    border-radius: 8px;
    padding: 16px;
    border: 1px solid rgba(156, 39, 176, 0.2);
  }
  
  .risk-level-badge {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(156, 39, 176, 0.1);
  }
  
  .risk-level-text {
    font-weight: 600;
    color: #9C27B0;
    font-size: 16px;
  }
  
  .risk-score-text {
    font-weight: 600;
    color: #7B1FA2;
    font-size: 16px;
  }
  
  .risk-stats {
    display: flex;
    gap: 20px;
    flex-wrap: wrap;
  }
  
  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  
  .stat-label {
    font-size: 12px;
    color: #666;
    font-weight: 500;
  }
  
  .stat-value {
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }
  
  .stat-value.flagged {
    color: #f44336;
  }
  
  .risk-report-file {
    background: white;
    border: 1px solid rgba(156, 39, 176, 0.2);
    border-radius: 8px;
    padding: 16px;
  }
  
  .risk-report-file h4 {
    margin: 0 0 12px 0;
    color: #9C27B0;
    font-size: 16px;
    font-weight: 600;
  }
  
  .file-metadata {
    display: flex;
    gap: 20px;
    margin-bottom: 12px;
    flex-wrap: wrap;
  }
  
  .metadata-item {
    font-size: 12px;
    color: #666;
    background: rgba(156, 39, 176, 0.05);
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid rgba(156, 39, 176, 0.1);
  }
  
  .report-content {
    background: #f8f9fa;
    padding: 12px;
    border-radius: 6px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.4;
    color: #333;
    white-space: pre-wrap;
    word-break: break-word;
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid rgba(156, 39, 176, 0.1);
  }
  
  .risk-recommendations {
    background: rgba(76, 175, 80, 0.05);
    border-radius: 8px;
    padding: 16px;
    border: 1px solid rgba(76, 175, 80, 0.2);
  }
  
  .risk-recommendations h4 {
    margin: 0 0 12px 0;
    color: #4CAF50;
    font-size: 16px;
    font-weight: 600;
  }
  
  .recommendations-list {
    margin: 0;
    padding-left: 20px;
  }
  
  .recommendation-item {
    margin-bottom: 8px;
    color: #333;
    font-size: 14px;
    line-height: 1.4;
  }
  
  .recommendation-item:last-child {
    margin-bottom: 0;
  }
  
  .risk-report-error {
    background: rgba(244, 67, 54, 0.05);
    border-radius: 8px;
    padding: 12px;
    border: 1px solid rgba(244, 67, 54, 0.2);
  }
  
  .error-label {
    font-weight: 600;
    color: #f44336;
    font-size: 14px;
    display: block;
    margin-bottom: 4px;
  }
  
  .error-message {
    color: #666;
    font-size: 13px;
  }
  
  .no-risk-report {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    background: rgba(156, 39, 176, 0.02);
    border-radius: 12px;
    border: 1px solid rgba(156, 39, 176, 0.1);
    margin: 20px 0;
  }
  
  .no-report-icon {
    font-size: 48px;
    margin-bottom: 16px;
    opacity: 0.5;
  }
  
  .no-report-text {
    color: #666;
    font-size: 16px;
    font-weight: 500;
    margin: 0;
  }
`;

// 将样式注入到页面中
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = additionalStyles;
  document.head.appendChild(styleElement);
}
