import React, { useState, useEffect } from 'react';
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client';
import { useWallet } from '@suiet/wallet-kit';
import { uploadFile, uploadContent, getContent } from '../utils/walrusUtils';
import { getAllMerchantInfo, registerMerchant, recordMerchantTransaction, getMerchantAddress } from '../utils/contractUtils';
import '../styles/MerchantUpload.less';

// 初始化客户端
const suiClient = new SuiClient({ url: getFullnodeUrl('testnet') });

// 组件部分 - 使用walrusUtils中的工具函数
const MerchantUpload = () => {
  const wallet = useWallet();
  
  // 商户相关状态
  const [merchants, setMerchants] = useState([]);
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const [loadingMerchants, setLoadingMerchants] = useState(false);
  const [merchantsError, setMerchantsError] = useState('');
  
  // 上传类型状态：'merchant_info'(商户信息) 或 'transaction_record'(交易记录)
  const [uploadType, setUploadType] = useState('merchant_info');

  // 在组件内部创建Walrus客户端实例
  const createWalrusClient = () => {
    return new WalrusClient({
      endpoint: '/api/walrus', // 使用本地代理路径（上传时使用）
      wallet: wallet // 传入钱包实例
    });
  };

  // 左侧上传部分状态
  const [contentToUpload, setContentToUpload] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadMode, setUploadMode] = useState('text'); // 'text' 或 'file'
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadedBlobId, setUploadedBlobId] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [merchantName, setMerchantName] = useState(''); // 商户名称
  const [industryType, setIndustryType] = useState(''); // 行业义务类型
  
  // 右侧查询部分状态
  const [queryBlobId, setQueryBlobId] = useState('');
  const [querying, setQuerying] = useState(false);
  const [queryResult, setQueryResult] = useState(null);
  const [queryError, setQueryError] = useState('');
  
  // 加载商户列表
  useEffect(() => {
    const loadMerchants = async () => {
      setLoadingMerchants(true);
      setMerchantsError('');
      try {
        const merchantList = await getAllMerchantInfo(wallet);
        setMerchants(merchantList);
        // 默认选择第一个商户
        if (merchantList.length > 0) {
          setSelectedMerchant(merchantList[0]);
        }
      } catch (error) {
        console.error('Failed to load merchant list:', error);
        setMerchantsError('Failed to load merchant list, please try again later');
      } finally {
        setLoadingMerchants(false);
      }
    };

    // 只有在钱包连接且地址存在时才加载商户列表
    if (wallet?.connected && wallet?.address) {
      loadMerchants();
    } else {
      // 钱包未连接时清空商户列表
      setMerchants([]);
      setSelectedMerchant(null);
      setLoadingMerchants(false);
    }
  }, [wallet?.connected, wallet?.address]); // 只依赖具体的状态值而不是整个对象
  
  // 上传内容或文件到ipfs
  const handleUpload = async () => {
    // 商户信息上传时验证必填字段
    if (uploadType === 'merchant_info') {
      if (!merchantName.trim()) {
        setUploadError('Please enter merchant name');
        return;
      }
      if (!industryType.trim()) {
        setUploadError('Please enter industry obligation type');
        return;
      }
    }
    
    if (uploadMode === 'text' && !contentToUpload.trim()) {
      setUploadError('Please enter the content to upload');
      return;
    }
    
    if (uploadMode === 'file' && !selectedFile) {
      setUploadError('Please select the file to upload');
      return;
    }
    
    if (!wallet.connected) {
      setUploadError('Please connect SUI wallet first to authorize upload operation');
      return;
    }
    
    // 仅在上传交易记录时验证商户选择
    if (uploadType === 'transaction_record' && !selectedMerchant) {
      setUploadError('Please select a merchant first');
      return;
    }
    
    try {
      setUploading(true);
      setUploadError('');
      setUploadSuccess(false);
      setUploadProgress(0);
      
      let blobId;
      
      // 创建进度回调函数
      const progressCallback = (percent) => {
        setUploadProgress(percent);
      };
      
      if (uploadMode === 'text') {
        // 文本模式：将文本转换为文件并上传，使用utils中的方法
        blobId = await uploadContent(contentToUpload, wallet, 'content.txt', progressCallback);
      } else {
        // 文件模式：直接上传文件，使用utils中的方法
        blobId = await uploadFile(selectedFile, wallet, progressCallback);
      }
      
      // 保存上传结果
      setUploadedBlobId(blobId);
      setUploadProgress(100);
      
      try {
        // 根据上传类型决定是否需要将blob_id发送到合约
        if (uploadType === 'transaction_record' && selectedMerchant) {
          await recordMerchantTransaction(selectedMerchant.blobId, blobId, wallet);
        } else {
          // 商户信息需要发送到合约
          if (merchantName && industryType) {
            try {
              // 获取商户地址（如果已有地址则使用，否则需要注册）
              let merchantAddress = selectedMerchant?.contractAddress || '';
              
              if (!merchantAddress) {
                // 如果没有地址，使用钱包地址作为商户地址
                merchantAddress = wallet.address;
              }
              // 调用新的registerMerchant方法注册商户
              await registerMerchant(blobId, merchantName, industryType, merchantAddress, wallet);              
              // 重新加载商户列表以获取最新数据
              const updatedMerchantList = await getAllMerchantInfo(wallet);
              setMerchants(updatedMerchantList);
              
              // 找到刚注册的商户并设为选中
              const newMerchant = updatedMerchantList.find(m => m.blobId === blobId);
              if (newMerchant) {
                setSelectedMerchant(newMerchant);
              }
            } catch (error) {
              console.error('Failed to register merchant information to contract:', error);
              setUploadError('Merchant information registration to contract failed: ' + error.message);
              setUploading(false);
              return;
            }
          }
        }
        
        setUploadSuccess(true);
        
        setTimeout(() => {
          setUploadSuccess(false);
        }, 5000);
      } catch (contractError) {
        console.error('Error when sending blob_id to contract:', contractError);
        // 上传成功但合约操作失败的情况下，仍显示上传成功
        setUploadSuccess(true);
        // 但显示合约操作失败的额外提示
        alert(`Upload successful, but error sending data to merchant contract: ${contractError.message}\nYou can manually use Blob ID: ${blobId}`);
        
        setTimeout(() => {
          setUploadSuccess(false);
        }, 5000);
      }
    } catch (error) {
      setUploadError(`Upload failed: ${error.message}`);
      setUploadProgress(0);
    } finally {
      setUploading(false);
    }
  };
  
  // 处理文件选择
  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setUploadError('');
    }
  };
  
  // 切换上传模式
  const toggleUploadMode = (mode) => {
    setUploadMode(mode);
    setSelectedFile(null);
    setUploadError('');
    // 清空文件输入
    const fileInput = document.getElementById('file-upload');
    if (fileInput) {
      fileInput.value = '';
    }
  };
  
  // 处理查询逻辑
  const handleQuery = async () => {
    if (!queryBlobId.trim()) {
      setQueryError('Please enter a valid Blob ID');
      return;
    }
    
    try {
      setQuerying(true);
      setQueryError('');
      setQueryResult(null);
      
      // 使用utils中的方法获取内容
      const result = await getContent(queryBlobId);
      
      // 处理查询结果
      setQueryResult({
        blobId: result.blobId,
        timestamp: new Date().toLocaleString(),
        content: result.content,
        contentType: result.metadata ? result.metadata.type : 'text/plain'
      });
    } catch (error) {
      console.error('Error occurred during query:', error);
      setQueryError(error.message);
    } finally {
      setQuerying(false);
    }
  };
  
  // 清空上传区域
  const handleClearUpload = () => {
    setContentToUpload('');
    setSelectedFile(null);
    setMerchantName(''); // 重置商户名称
    setIndustryType(''); // 重置行业义务类型
    setUploadedBlobId('');
    setUploadSuccess(false);
    setUploadError('');
    setUploadProgress(0);
    // 清空文件输入
    const fileInput = document.getElementById('file-upload');
    if (fileInput) {
      fileInput.value = '';
    }
  };
  
  // 清空查询区域
  const handleClearQuery = () => {
    setQueryBlobId('');
    setQueryResult(null);
    setQueryError('');
  };

  return (
    <div className="walrus-content-manager">
      <div className="page-header">
        <h1>IPFS Content Management</h1>
        <p>Upload content to IPFS storage or query stored content</p>
        <div className="wallet-status">
          {wallet.connected ? (
            <div className="connected-status">
              <span className="status-indicator connected">●</span>
              <span className="wallet-address">
                Wallet connected: {wallet.address?.slice(0, 6)}...{wallet.address?.slice(-4)}
              </span>
            </div>
          ) : (
            <div className="disconnected-status">
              <span className="status-indicator disconnected">●</span>
              <span className="wallet-message">Please connect SUI wallet to upload content</span>
            </div>
          )}
        </div>
      </div>
      
      <div className="content-layout">
        {/* 左侧上传区域 */}
        <div className="panel upload-panel">
          <div className="panel-header">
            <h2>Upload Content to IPFS</h2>
          </div>
          
          <div className="panel-body">
            {/* 上传模式切换按钮 */}
            <div className="mode-switch">
              <button 
                className={`mode-btn ${uploadMode === 'text' ? 'active' : ''}`}
                onClick={() => toggleUploadMode('text')}
              >
                Text Upload
              </button>
              <button 
                className={`mode-btn ${uploadMode === 'file' ? 'active' : ''}`}
                onClick={() => toggleUploadMode('file')}
              >
                File Upload
              </button>
            </div>
            
            {/* 文本输入区域 */}
            {uploadMode === 'text' && (
              <div className="input-container">
                <textarea
                  className="large-input"
                  value={contentToUpload}
                  onChange={(e) => setContentToUpload(e.target.value)}
                  placeholder="Please enter the content to upload to IPFS..."
                  rows={20}
                />
              </div>
            )}
            
            {/* 文件上传区域 */}
            {uploadMode === 'file' && (
              <div className="file-upload-group">
                <input
                  id="file-upload"
                  type="file"
                  className="file-input"
                  onChange={handleFileChange}
                  accept="*/*"
                />
                <label htmlFor="file-upload" className="file-upload-label">
                  {selectedFile ? selectedFile.name : 'Click to select file or drag and drop file here'}
                </label>
                {selectedFile && (
                  <div className="file-info">
                    <span>File name: {selectedFile.name}</span>
                    <span>Size: {(selectedFile.size / 1024).toFixed(2)} KB</span>
                  </div>
                )}
              </div>
            )}
            

            
            {/* 上传进度条 */}
            {uploading && (
              <div className="progress-bar">
                <div className="progress-bar-container">
                  <div 
                    className="progress-fill"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
                <span className="progress-text">{uploadProgress}%</span>
              </div>
            )}
            
            {/* 上传类型选择 */}
            <div className="upload-type-selector">
              <label>Upload Type:</label>
              <div className="radio-group">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="uploadType"
                    value="merchant_info"
                    checked={uploadType === 'merchant_info'}
                    onChange={() => setUploadType('merchant_info')}
                  />
                  <span>Upload Merchant Information</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="uploadType"
                    value="transaction_record"
                    checked={uploadType === 'transaction_record'}
                    onChange={() => setUploadType('transaction_record')}
                  />
                  <span>Upload Transaction Record</span>
                </label>
              </div>
            </div>
            
            {/* 商户信息输入字段 - 仅在上传商户信息时显示 */}
            {uploadType === 'merchant_info' && (
              <div className="merchant-info-fields">
                <div className="param-group">
                  <label htmlFor="merchant-name">Merchant Name:</label>
                  <input
                    id="merchant-name"
                    type="text"
                    value={merchantName}
                    onChange={(e) => setMerchantName(e.target.value)}
                    placeholder="Please enter merchant name"
                    className="param-input"
                  />
                </div>
                
                <div className="param-group">
                  <label htmlFor="industry-type">Industry Obligation Type:</label>
                  <input
                    id="industry-type"
                    type="text"
                    value={industryType}
                    onChange={(e) => setIndustryType(e.target.value)}
                    placeholder="Please enter industry obligation type"
                    className="param-input"
                  />
                </div>
              </div>
            )}
            
            {/* 商户选择下拉框 - 仅在上传交易记录时显示 */}
            {uploadType === 'transaction_record' && (
              <div className="merchant-selector">
                <label htmlFor="merchant-select">Select Merchant:</label>
                {loadingMerchants ? (
                  <div className="loading-merchants">Loading merchants...</div>
                ) : merchantsError ? (
                  <div className="merchants-error">{merchantsError}</div>
                ) : (
                  <select
                    id="merchant-select"
                    className="merchant-select"
                    value={selectedMerchant ? selectedMerchant.id : ''}
                    onChange={(e) => {
                      const merchantId = e.target.value;
                      const merchant = merchants.find(m => m.id === merchantId);
                      if (merchant) {
                        setSelectedMerchant(merchant);
                      }
                    }}
                  >
                    <option value="">Please select merchant</option>
                    {merchants.map((merchant) => (
                      <option key={merchant.id} value={merchant.id}>
                        {merchant.name} - {merchant.description}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
            
            {uploadSuccess && (
                <div className="success-message">
                  <div className="success-icon">✓</div>
                  <p>Upload Successful!</p>
                  {uploadedBlobId && (
                    <div className="blob-id">
                      <span className="label">Blob ID: </span>
                      <code>{uploadedBlobId}</code>
                    </div>
                  )}
                  {uploadType === 'transaction_record' && selectedMerchant && (
                    <div className="contract-status">
                      <span className="label">Contract Status: </span>
                      <span className="status-text">Blob ID has been sent to merchant {selectedMerchant.name}'s contract</span>
                    </div>
                  )}
                  {uploadType === 'merchant_info' && (
                    <div className="contract-status">
                      <span className="label">Contract Status: </span>
                      <span className="status-text">Merchant information uploaded successfully, no need to send to specific contract</span>
                    </div>
                  )}
                </div>
              )}
            
            {uploadError && (
              <div className="error-message">
                <div className="error-icon">!</div>
                <p>{uploadError}</p>
              </div>
            )}
            
            <div className="action-buttons">
              <button 
                className="btn btn-upload"
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading ? 'Uploading...' : 'Upload Content'}
              </button>
              <button 
                className="btn btn-clear"
                onClick={handleClearUpload}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
        
        {/* 右侧查询区域 */}
        <div className="panel query-panel">
          <div className="panel-header">
            <h2>Query Content from IPFS</h2>
          </div>
          
          <div className="panel-body">
            <div className="query-input-group">
              <input
                type="text"
                className="query-input"
                value={queryBlobId}
                onChange={(e) => setQueryBlobId(e.target.value)}
                placeholder="Please enter blob_id for query"
              />
              <button 
                className="btn btn-query"
                onClick={handleQuery}
                disabled={querying}
              >
                {querying ? 'Querying...' : 'Query'}
              </button>
            </div>
            
            {queryError && (
              <div className="error-message">
                <div className="error-icon">!</div>
                <p>{queryError}</p>
              </div>
            )}
            
            {queryResult && (
              <div className="query-result">
                <div className="result-header">
                  <h3>Query Results</h3>
                </div>
                <div className="result-info">
                  <div className="result-item">
                    <span className="label">Blob ID: </span>
                    <code>{queryResult.blobId}</code>
                  </div>
                  <div className="result-item">
                    <span className="label">Timestamp: </span>
                    <span>{queryResult.timestamp}</span>
                  </div>
                  <div className="result-item">
                    <span className="label">Content Type: </span>
                    <span>{queryResult.contentType}</span>
                  </div>
                  <div className="result-item">
                    <span className="label">Content: </span>
                    <pre className="content-display">{queryResult.content}</pre>
                  </div>
                </div>
              </div>
            )}
            
            <div className="action-buttons">
              <button 
                className="btn btn-clear"
                onClick={handleClearQuery}
                disabled={querying}
              >
                Clear Query
              </button>
              
              {/* 使用说明链接 */}
              <button 
                className="btn btn-help"
                onClick={() => {
                  alert('Usage Instructions:\n1. Upload content or files to IPFS on the left side\n2. Get Blob ID after successful upload\n3. Enter Blob ID on the right side and click query\n4. Text content will be displayed directly, binary content can be downloaded\n5. You can configure storage period (epochs) and receiving address');
                }}
              >
                Usage Help
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MerchantUpload;
