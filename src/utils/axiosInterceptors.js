/*
 * @Author: Matbin
 * @Date: 2023-11-21 13:51:04
 * @Description: 请求配置
 */
import axios from "axios";
import nProgress from 'nprogress'


const HTTP_CONFIG = {
  baseURL: '/api/',
  /*
   * 原来 10 秒。部署到共享主机后，Passenger 空闲会回收 Node 进程，
   * 冷启动要重新加载几百个接口定义，首屏请求经常卡在 10 秒边缘。
   * 放宽到 15 秒 + 超时自动重试一次（见下面的响应拦截），
   * 重试通常能命中已经热起来的进程，比直接报错体验好得多。
   */
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
   * 共享主机上最常见的超时不是接口挂了，而是 Passenger 冷启动：
   * 进程被回收后，第一次请求要等 Node 重新把应用拉起来，几秒就过去了。
   * 这种情况下重试一次基本能命中已经热好的进程。
   *
   * 限制条件：只重试 GET、每条请求最多一次，避免把压力放大。
   * （本项目所有接口都是 GET，所以实际就是"一次超时 = 一次重试"）
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