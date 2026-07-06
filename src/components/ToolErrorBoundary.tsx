import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
  resetKey: string
  message: string
  actionLabel: string
}

type State = {
  hasError: boolean
}

export class ToolErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Tool crashed:', error, info)
  }

  componentDidUpdate(previousProps: Props) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false })
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div className="tool-section tool-error">
        <h2>{this.props.message}</h2>
        <button className="button primary" type="button" onClick={() => this.setState({ hasError: false })}>
          {this.props.actionLabel}
        </button>
      </div>
    )
  }
}
