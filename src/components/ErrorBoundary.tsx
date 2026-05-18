'use client'

import { Component, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
          <div className="max-w-sm w-full text-center space-y-4">
            <p className="text-4xl">😬</p>
            <h1 className="text-white font-bold text-xl">Algo deu errado</h1>
            <p className="text-gray-400 text-sm">
              {this.state.error.message ?? 'Erro inesperado.'}
            </p>
            <button
              onClick={() => { this.setState({ error: null }); window.location.reload() }}
              className="px-6 py-2.5 bg-white text-gray-900 font-semibold rounded-xl text-sm hover:bg-gray-100 transition-colors"
            >
              Recarregar
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
