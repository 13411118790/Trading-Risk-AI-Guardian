import axios from 'axios';

// IPFS API配置
const IPFS_GATEWAY = 'https://ipfs.io';
const IPFS_API_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const IPFS_API_KEY = '5***********7';
const IPFS_API_SECRET = 'ab****************************************cd';

/**
 * 上传文件到IPFS
 * @param {File} file - 要上传的文件对象
 * @param {Object} wallet - 钱包对象（用于检查连接状态）
 * @param {Function} onProgress - 可选的进度回调函数
 * @returns {Promise<string>} 返回上传后的IPFS CID
 */
export const uploadFile = async (file, wallet, onProgress = null) => {  
  // 检查钱包是否已连接
  if (!wallet || !wallet.connected) {
    throw new Error('请先连接SUI钱包以授权上传操作');
  }
  
  try {
    // 创建FormData对象
    const formData = new FormData();
    formData.append('file', file);
    
    // 使用Pinata API上传文件到IPFS
    const response = await axios({
      method: 'post',
      url: IPFS_API_URL,
      data: formData,
      headers: {
        'Content-Type': 'multipart/form-data',
        'pinata_api_key': IPFS_API_KEY,
        'pinata_secret_api_key': IPFS_API_SECRET
      },
      timeout: 60000, // 增加超时时间
      // 添加上传进度监控
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress && typeof onProgress === 'function') {
          const percentComplete = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentComplete);
        }
      }
    });
    
    // 返回IPFS CID
    return response.data.IpfsHash;
  } catch (error) {
    console.error('IPFS文件上传错误:', error);
    
    // 增强错误信息处理
    if (error.response) {
      const errorMsg = `文件上传失败: ${error.response.status} ${error.response.statusText}`;
      const errorData = error.response.data;
      if (errorData) {
        throw new Error(`${errorMsg} - ${typeof errorData === 'string' ? errorData : JSON.stringify(errorData)}`);
      }
      throw new Error(errorMsg);
    } else if (error.request) {
      throw new Error('文件上传失败: 服务器无响应，请检查网络连接和API端点是否可用');
    } else {
      throw new Error(`文件上传失败: ${error.message}`);
    }
  }
};

/**
 * 上传文本内容到IPFS
 * @param {string} content - 要上传的文本内容
 * @param {Object} wallet - 钱包对象（用于检查连接状态）
 * @param {string} fileName - 文件名，默认content.txt
 * @param {Function} onProgress - 可选的进度回调函数
 * @returns {Promise<string>} 返回上传后的IPFS CID
 */
export const uploadContent = async (content, wallet, fileName = 'content.txt', onProgress = null) => {  
  // 检查钱包是否已连接
  if (!wallet || !wallet.connected) {
    throw new Error('请先连接SUI钱包以授权上传操作');
  }
  
  // 创建Blob对象
  const blob = new Blob([content], { type: 'text/plain' });
  
  // 创建File对象
  const file = new File([blob], fileName, { type: 'text/plain' });
  
  // 调用文件上传方法
  return await uploadFile(file, wallet, onProgress);
};

/**
 * 从IPFS获取内容
 * @param {string} cid - 要获取的内容的IPFS CID
 * @returns {Promise<Object>} 返回包含内容和元数据的对象
 */
export const getContent = async (cid) => {  
  try {
    // 使用IPFS网关获取内容
    const response = await axios({
      method: 'get',
      url: `${IPFS_GATEWAY}/ipfs/${cid}`,
      timeout: 30000 // 设置30秒超时
    });
    
    // 直接返回响应数据
    return {
      blobId: cid, // 保持API兼容性，使用cid作为blobId
      content: response.data,
      timestamp: new Date().toISOString(),
      metadata: {
        size: response.headers['content-length'] || 0,
        type: response.headers['content-type'] || 'application/octet-stream'
      }
    };
  } catch (error) {
    console.error('IPFS获取内容错误:', error);
    
    // 增强错误信息处理
    if (error.response) {
      if (error.response.status === 404) {
        throw new Error('未找到指定的内容');
      }
      const errorMsg = `获取内容失败: ${error.response.status} ${error.response.statusText}`;
      throw new Error(errorMsg);
    } else if (error.request) {
      // 请求已发送但没有收到响应
      throw new Error('获取内容失败: 服务器无响应，请检查网络连接和API端点是否可用');
    } else {
      // 请求配置出错
      throw new Error(`获取内容失败: ${error.message}`);
    }
  }
};

// 导出默认对象，支持两种导入方式
export default {
  uploadFile,
  uploadContent,
  getContent
};