import Upload from './Upload'
import PetView from './PetView'

const params = new URLSearchParams(window.location.search)
const view = params.get('view')

export default function App() {
  if (view === 'settings') {
    return <Upload />
  }

  // Default: transparent overlay
  return <PetView />
}
