import Upload from './Upload'
import PetView from './PetView'
import Preferences from './Preferences'
import OnboardingWizard from './OnboardingWizard'

const params = new URLSearchParams(window.location.search)
const view = params.get('view')

export default function App() {
  if (view === 'onboarding')  return <OnboardingWizard />
  if (view === 'settings')    return <Upload />
  if (view === 'preferences') return <Preferences />
  return <PetView />
}
