# Seedance 2.0 (即梦) Platform Reference

Distilled platform playbook for building paste-ready Seedance 2.0 prompts. Pair this with `effects-breakdown-reference.txt` (shot-level craft) — this file covers the model's capabilities, the `@` reference grammar, timestamp shot lists, video extension, and vocab libraries.

## Platform specs & limits

| Dimension | Spec |
|-----------|------|
| Image input | jpeg/png/webp/bmp/tiff/gif, ≤9 images, <30MB each |
| Video input | mp4/mov, ≤3 clips, 2-15s total, <50MB each, 480p-720p |
| Audio input | mp3/wav, ≤3 clips, ≤15s total, <15MB each |
| Mixed cap | ≤12 files total (images + video + audio) |
| Generation length | 4-15s per pass, free choice |
| Audio output | native SFX / score |
| Resolution | up to 2K |

**Hard limits**
- Photoreal human faces in uploaded images/video are auto-blocked.
- Reference video raises generation cost.
- When extending a video, the chosen length is the **new portion only** (extend 5s → set length 5s).

## The `@` reference system

Cite uploaded assets inline with official names — never `@img1`/`@video1`:
- Images: `@图片1` … `@图片9`
- Video: `@视频1` … `@视频3`
- Audio: `@音频1` … `@音频3`

Always state each reference's **purpose**:
- `@图片1为首帧` (as first frame)
- `参考@视频1的运镜效果` (reference its camera work)
- `背景音乐参考@音频1` (BGM from this)
- `@图片1的人物形象` (this character)
- `参考@视频1的打斗动作` (reference this combat motion)

Distinguish **参考** (reference a style/motion) from **编辑** (edit the source asset directly).

## Ten core capabilities (input modes)

1. **Text-to-video** (no assets): `(主体) + (动作序列) + (环境/光影) + (镜头语言) + (风格)`
2. **Consistency control** (character/product/scene): `[角色]@图片N + [动作/剧情] + [场景]@图片N + [运镜/光影]`
3. **Camera & motion replication**: `参考@视频1的[运镜/动作/节奏] + [主体]@图片N + [场景]`
4. **Effect/template replication**: `参考@视频1的[特效/转场/创意] + 将[元素]替换为@图片N + [补充]`
5. **Story creation/completion**: `[分镜脚本/图片内容] + [演绎方式] + [音效/台词]`
6. **Video extension**: `将@视频1延长Xs + [新增内容]` (forward or backward)
7. **Sound control**: `[画面] + 音色/旁白参考@视频1 + [台词用引号]`
8. **One-take (一镜到底)**: `一镜到底 + @图片1@图片2… + [连续场景] + 全程不要切镜头`
9. **Video editing**: `将@视频1中的[A]换成@图片1 + [修改]` / `颠覆@视频1的剧情 + [新剧情]`
10. **Music sync (卡点)**: `@图片1@图片2… + 参考@视频1的画面节奏/卡点 + [风格]`

## Timestamp shot list (13-15s)

The most-used advanced technique — split a clip into timed beats, each with its own shot + camera language:

```
0-3秒：[画面 + 镜头语言]
4-8秒：[画面 + 镜头语言]
9-12秒：[画面 + 镜头语言]
13-15秒：[画面 + 镜头语言]
```

Example (wuxia battle):
```
15秒仙侠高燃战斗，金红暖色调，0-3秒：低角度特写主角紧握雷纹巨剑，剑刃赤红电光爆闪，主角低喝"今日，便以这柄剑，镇尔等邪祟！"；4-8秒：环绕摇镜快切旋身挥剑迸射红色冲击波，前排魔兵碎裂成灰烬；9-12秒：仰拍拉远定格慢放跃起劈向魔兵群；13-15秒：缓推特写落地收剑，冷声道"此界之门，不容踏越"，音效收束为余音震颤。
```

Dialogue/short-drama variant — separate 画面 / 台词 / 音效 lines, mark speaker + emotion, end with `时长：精准15秒`.

## Video extension for >15s

Single pass caps at 15s. For longer pieces, chain segments:
1. Split total duration into ≤15s segments by narrative beat.
2. Each segment needs a **hand-off frame**: prior segment's final state = next segment's opening state.
3. Segment 1 generates normally; later segments use `将@视频1延长Xs` (upload the prior render as `@视频1`).
4. Label each segment's index and what it picks up.

| Total | Segments |
|-------|----------|
| 16-30s | 2 |
| 31-45s | 3 |
| 46-60s | 4 |
| >60s | split into independent scenes, edit together |

## Technical-spec header

Open the prompt with explicit specs when precision matters:
```
[竖屏/横屏] + [画幅比 2.35:1 / 16:9 / 9:16] + [帧率 24fps] + [时长 Xs] + [色调/风格总纲]
```

## No negative prompts

Seedance has no `--no`. Declare unwanted elements in a closing block:
```
禁止：任何文字、字幕、LOGO或水印；画面全部片段都不要出现字幕
```

## Camera-language vocabulary (镜头语言)

| Category | Terms |
|----------|-------|
| 景别 Shot size | 大远景、远景、全景、中景、近景、特写、大特写 |
| 运镜 Movement | 推、拉、摇、移、跟拍、环绕拍摄、航拍、手持跟拍、希区柯克变焦 |
| 角度 Angle | 平视、俯拍、仰拍、低角度、鸟瞰、鱼眼、第一人称、主观视角 |
| 节奏 Pacing | 慢动作、快切、延时、一镜到底、升格、硬切、卡点 |
| 焦点 Focus | 浅景深、深景深、焦点转移、虚化背景、选择性对焦 |
| 特殊 Special | 遮挡擦镜转场、无缝渐变转场、环绕摇镜快切、定格慢放 |

## Style vocabulary (风格)

| Category | Terms |
|----------|-------|
| 质感 Texture | 电影感、胶片质感、8K、HDR、RAW质感、4K医学CGI |
| 影像 Format | 好莱坞大片、独立电影、纪录片、MV、广告大片、Vlog、2.35:1宽银幕 |
| 色调 Tone | 暖/冷色调、高对比、低饱和、莫兰迪、赛博朋克霓虹、红金高饱和 |
| 艺术 Art | 写实、超现实、极简、蒸汽波、赛博朋克、中国风水墨、3D国漫CG |
| 光影 Light | 自然光、侧逆光、丁达尔效应、霓虹、月光、黄金时段、体积光 |
| 动画 Anime | 中国奇幻动画、超精细CG、日漫赛璐璐、3D渲染写实 |

## Match image style to theme

When generating reference stills, match the style to the subject:
- 仙侠/修真 → 3D 国漫渲染、中国仙侠概念设计
- 古风/历史 → 中国风工笔画、水墨、古典绘画
- 赛博朋克/科幻 → 未来科幻写实CG、概念设计
- 现实/人物 → 电影摄影写实、人像摄影
- 美食 → 美食广告摄影、商业摄影
- 自然风光 → 风光摄影、航拍纪录片
