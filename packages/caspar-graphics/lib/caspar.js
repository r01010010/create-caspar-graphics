import React from 'react'
import { TimelineMax } from 'gsap'
import { getQueryData } from './utils/parse'
import { addCasparMethods, removeCasparMethods } from './utils/caspar-methods'
import { isProduction, States } from './constants'
import withTransition from './utils/with-transition'
import scaleToFit from './utils/scale-to-fit'

export default class Caspar extends React.Component {
  timeline = new TimelineMax({ paused: true })

  state = {
    isLoaded: false,
    didStart: false,
    didMount: false,
    didError: false,
    preventTimelineAutoplay: false,
    state: undefined,
    data: undefined
  }

  constructor(props) {
    super()
    addCasparMethods(this)
    this.Graphic = withTransition(props.template, this.remove)
    this.state.data = props.data || getQueryData()
  }

  componentDidCatch(error, info) {
    this.log(error)
    this.setState({ didError: true })
  }

  onKeyDown = evt => {
    const fn = {
      F1: this.stop,
      F2: this.play,
      F3: this.load,
      F4: this.pause,
      F6: this.update,
      F7: this.preview
    }[evt.key]
    fn && fn()
  }

  componentDidMount() {
    this.setState({ didMount: true })

    document.addEventListener('keydown', this.onKeyDown)

    if (this.props.autoPreview || this.state.data._autoPreview) {
      this.preview()
    }

    if (this.state.data._fit) {
      scaleToFit()
    }
  }

  componentWillUnmount() {
    removeCasparMethods(this)
    document.removeEventListener('keydown', this.onKeyDown)
    this.timeline.clear()
    this.timeline.kill()
    this.timeline = null
  }

  componentDidUpdate(prevProps, prevState) {
    if (this.props.data !== prevProps.data) {
      this.update(this.props.data)
      return
    }

    const { preventTimelineAutoplay, state, didMount } = this.state

    if (
      didMount &&
      state === States.playing &&
      prevState.state !== States.playing &&
      preventTimelineAutoplay === false
    ) {
      this.timeline.play()
    }

    if (this.props.onStateChange && prevState.state !== state) {
      this.props.onStateChange(state)
    }
  }

  log = (message, ...rest) => {
    console.log(`${this.props.name || 'caspar'}${message}`)
    rest && rest.length && console.log(rest)
  }

  preview = () => {
    this.log('.preview()')
    this.setState({
      state: States.playing,
      data: this.props.data || {
        ...(this.props.template.previewData || {}),
        ...(getQueryData() || {})
      }
    })
  }

  play = () => {
    this.log('.play()')
    this.setState(state => ({
      state: States.playing,
      data: state.data || {}
    }))
  }

  stop = () => {
    this.log('.stop()')
    this.setState({
      state: States.stopped
    })
  }

  pause = () => {
    this.log('.pause()')
    this.setState({ state: States.paused })
  }

  load = () => {
    this.log('.load()')
    this.setState({ isLoaded: true })
  }

  update = (data = this.props.data || {}) => {
    this.log(`.update(${JSON.stringify(data || {}, null, 2)})`)
    this.setState({ data })
  }

  remove = () => {
    this.log('.remove()')
    this.timeline.clear()
    this.timeline.kill()
    this.timeline = new TimelineMax({ paused: true })
    this.setState({
      didStart: false,
      data: this.props.data || getQueryData()
    })

    // TODO: Uncomment when caspar can handle it.
    // setTimeout(() => window.remove && window.remove(), 100)
  }

  disableAutoPlay = () => {
    this.setState({ preventTimelineAutoplay: true })
  }

  onReadyToPlay = shouldPlay => {
    if (shouldPlay === false) {
      return
    }

    this.timeline.play()
    this.setState({ didStart: true })
  }

  requestInitialPlay = () => {
    // If the component has defined a componentWillPlay() method,
    // we wait for it to tell us it's ready.
    if (this.graphicRef.componentWillPlay) {
      this.graphicRef.componentWillPlay(this.onReadyToPlay)
    } else {
      this.onReadyToPlay()
    }
  }

  componentDidUpdate(prevProps, prevState) {
    // New data from props (dev preview)
    if (this.props.data !== prevProps.data) {
      this.update(this.props.data)
      return
    }

    // Notify listeners about changes in Caspar state.
    if (this.props.onStateChange && prevState.state !== this.state.state) {
      this.props.onStateChange(this.state.state)
    }

    const { state, didMount, didStart } = this.state

    // Wait for component to mount before doing anything.
    if (!didMount || !this.graphicRef) {
      return
    }

    // Play
    if (state === States.playing && prevState.state !== States.playing) {
      if (!this.state.didStart) {
        this.requestInitialPlay()
      } else {
        this.timeline.play()
      }
    }

    // Pause
    if (state === States.paused && prevState.state !== States.paused) {
      this.timeline.pause()
    }
  }

  onGraphicRef = ref => {
    this.graphicRef = ref
  }

  render() {
    const { Graphic } = this
    const { state, data, didStart } = this.state

    return (
      <div
        style={{
          background:
            data._bg != null
              ? data._bg === true
                ? '#5ebb78'
                : data._bg
              : 'none',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          height: '100%',
          opacity: didStart ? 1 : 0,
          width: '100%'
        }}
      >
        <Graphic
          ref={this.onGraphicRef}
          shouldRender={state !== States.stopped}
          data={data}
          timeline={this.timeline}
          didStart={didStart}
          isPreview={!isProduction || data._preview === true}
          isPaused={state === States.paused}
          onRemove={this.remove}
          disableAutoPlay={this.disableAutoPlay}
        />
      </div>
    )
  }
}
