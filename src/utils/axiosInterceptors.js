/*
 * @Author: Matbin
 * @Date: 2023-11-21 13:51:04
 * @Description: 请求配置
 */
import axios from "axios";
import nProgress from 'nprogress'


const HTTP_CONFIG = {
  baseURL: '/api/',
  timeout: 15000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest'
  }
}

const http = axios.create(HTTP_CONFIG)

const handleRequestStart = (config) => {
  nProgress.start()
  return config
}

const handleRequestError = (error) => {
  nProgress.done()
  return Promise.reject(error)
}

const handleResponseSuccess = (response) => {
  nProgress.done()
  if (response.status === 200) {
    return response.data
  }
  return Promise.reject(response)
}

const handleResponseError = async (error) => {
  nProgress.done()

  /*
   * 超时自动重试一次。
   */
  const config = error.config
  const isTimeout = error.code === 'ECONNABORTED' || /timeout/i.test(error.message || '')
  const method = (config?.method || 'get').toLowerCase()
  if (isTimeout && config && !config.__retried && method === 'get') {
    config.__retried = true
    nProgress.start()
    return http(config)
  }

  return Promise.reject(error)
}

// 请求拦截
http.interceptors.request.use(
  handleRequestStart,
  handleRequestError
)
// 响应拦截
http.interceptors.response.use(
  handleResponseSuccess,
  handleResponseError
)

export default http