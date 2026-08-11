import { Component } from 'react'
import { Button } from './ui'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="estado error" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
          <strong>Ocurrió un error en esta vista.</strong>
          <span style={{ fontSize: '.75rem' }}>{this.state.error.message}</span>
          <div style={{ marginTop: 8 }}>
            <Button variant="secundario" onClick={() => this.setState({ error: null })}>
              Reintentar
            </Button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
