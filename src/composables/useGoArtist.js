/*
 * @Description: 点击歌手名跳转歌手热门页
 *
 * 列表页、播放控制栏、全屏歌词页都要用到，统一收在这里，
 * 避免每个组件各写一份 id 校验 + 路由参数拼接。
 */
import { useRouter } from 'vue-router'
import { normalBack } from '@/utils/MessageBack'

export function useGoArtist() {
  const router = useRouter()

  /**
   * @param {{ id?: number|string, name?: string }} artist 歌手对象（搜索/歌单详情里的字段都带 id）
   */
  const goArtist = artist => {
    const id = artist?.id
    if (!id) return normalBack('warning', '暂无法获取该歌手信息')

    const current = router.currentRoute.value
    // 记录来源页：已在歌手页点合作歌手时沿用最初的来源，别记成上一个歌手页
    const from =
      current.name === 'artistSongs'
        ? typeof current.query.from === 'string'
          ? current.query.from
          : ''
        : current.fullPath

    const navigation = {
      name: 'artistSongs',
      params: { id: String(id) },
      query: {
        // 名字只为首屏标题，数据仍以接口为准
        ...(artist.name ? { name: artist.name } : {}),
        ...(from ? { from } : {})
      }
    }
    if (current.name === 'artistSongs') router.replace(navigation)
    else router.push(navigation)
  }

  return { goArtist }
}
