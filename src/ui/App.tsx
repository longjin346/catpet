import PetView from './PetView'

// Determine which view to show based on URL query param
const params = new URLSearchParams(window.location.search)
const view = params.get('view')

export default function App() {
  if (view === 'settings') {
    return (
      <div style={{ padding: 32, fontFamily: 'sans-serif' }}>
        <h1>CatPet Settings</h1>
        <p style={{ marginTop: 16, color: '#666' }}>
          Settings UI coming in Session 2.
        </p>
      </div>
    )
  }

  // Default: transparent overlay with pet canvas
  return <PetView />
}
