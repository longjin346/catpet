import Upload from './Upload'
import PetView from './PetView'
import Preferences from './Preferences'

const params = new URLSearchParams(window.location.search)
const view = params.get('view')

export default function App() {
  if (view === 'settings')     return <Upload />
  if (view === 'preferences')  return <Preferences />
  return <PetView />
}
