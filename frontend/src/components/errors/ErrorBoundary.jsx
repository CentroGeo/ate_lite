import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Actualiza el estado para que el siguiente renderizado muestre la interfaz de repuesto
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Aquí podrías enviar el error a un servicio de reporte de errores
    console.error("Error capturado por ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      // Renderiza cualquier interfaz de repuesto personalizada
      return (
        <div className="flex flex-col items-center justify-center min-h-[300px] w-full bg-red-50/50 p-6 rounded-xl border border-red-100 m-2">
          <div className="text-center max-w-lg w-full">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-red-700 mb-2">Algo no funcionó como se esperaba</h2>
            <p className="text-sm text-red-800/80 mb-6">
              Ha ocurrido un error inesperado al renderizar este componente de la interfaz.
            </p>
            
            {this.state.error && (
              <div className="bg-white/80 p-4 rounded-lg text-left overflow-x-auto text-xs font-mono text-red-900 border border-red-100 mb-6 shadow-inner">
                <span className="font-semibold block mb-1">Detalle del error:</span>
                {this.state.error.toString()}
              </div>
            )}

            <button
              onClick={() => {
                // Limpia el error e intenta recargar la vista del componente
                this.setState({ hasError: false, error: null, errorInfo: null });
                if (this.props.onReset) {
                  this.props.onReset();
                } else {
                  window.location.reload();
                }
              }}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-all shadow hover:shadow-md active:scale-95"
            >
              Recargar la vista
            </button>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

export default ErrorBoundary;
