/**
 * 白噪音环境音预设（1.16.0 起改为 CC0 真实录音）。
 *
 * 四段素材均来自开放素材站、CC0 1.0 公共领域奉献（无需署名、可自由使用与商用），
 * 已转码为 64kbps 立体声 MP3（Safari 不支持 ogg）随应用打包，经 Service Worker
 * 预缓存、完全离线可用。素材出处与许可详见 THIRD_PARTY_NOTICES.md 与
 * docs/书时-开源组件与合规.md，应用内致谢见「我的」页开源致谢。
 *
 * src 为相对 public/ 根目录的路径，组件侧拼接 import.meta.env.BASE_URL 后使用。
 */

export interface NoisePreset {
  key: string;
  label: string;
  /** public/ 下的音频文件相对路径（.mp3，立体声 64kbps 循环） */
  src: string;
  /** 素材作者（合规登记用） */
  author: string;
  /** 素材出处 */
  source: string;
}

export const NOISE_PRESETS: NoisePreset[] = [
  {
    key: 'rain',
    label: '雨声',
    src: 'audio/rain.mp3',
    author: 'Ylmir',
    source: 'https://opengameart.org/content/rain-loopable',
  },
  {
    key: 'waves',
    label: '海浪',
    src: 'audio/ocean.mp3',
    author: 'Rmutt',
    source: 'https://freesound.org/people/Rmutt/sounds/145213/',
  },
  {
    key: 'forest',
    label: '森林',
    src: 'audio/forest.mp3',
    author: 'Spring Spring',
    source: 'https://opengameart.org/content/birds-and-wind-ambient-birds-wind-and-synth',
  },
  {
    key: 'fire',
    label: '篝火',
    src: 'audio/fire.mp3',
    author: 'PagDev',
    source: 'https://opengameart.org/content/fireplace-sound-loop',
  },
];
