/*
 * @Description: 点击歌手名跳转歌手热门页
 *
 * 列表页、播放控制栏、全屏歌词页都要用到，统一收在这里，
 * 避免每个组件各写一份 id 校验 + 路由参数拼接。
 */
import { useRouter } from 'vue-router'
import { normalBack } from '@/utils/MessageBack'

export function useGoArtist () {
  const router = useRouter()

  /**
   * @param {{ id?: number|string, name?: string }} artist 歌手对象（搜索/歌单详情里的字段都带 id）
   */
  const goArtist = (artist) => {
    const id = artist?.id
    if (!id) return normalBack('warning', '暂无法获取该歌手信息')

    const current = router.currentRoute.value
    /*
     * 记录用户是从哪个页面点进来的，歌手页的返回按钮据此原路返回。
     * - 从普通页面（搜索/收藏/歌单）进入：来源就是当前地址；
     * - 已经在歌手页里点合作歌手：沿用最初的来源页，不要记成上一个歌手页，
     *   否则连点几个歌手后返回会一层层往回退。
     */
    const from = current.name === 'artistSongs'
      ? (typeof current.query.from === 'string' ? current.query.from : '')
      : current.fullPath

    router.push({
      name: 'artistSongs',
      params: { id: String(id) },
      query: {
        // 名字放 query 只是为了目标页首屏立刻有标题，真正的数据仍以接口返回为准
        ...(artist.name ? { name: artist.name } : {}),
        ...(from ? { from } : {})
      }
    })
  }

  return { goArtist }
}
