import { Link } from 'react-router-dom';

const content = {
  '403': ['Access unavailable', 'Your account does not have permission to open this page.'],
  session: ['Your session ended', 'Sign in again to continue to your Brightloop workspace.'],
  'account-closed': ['Account closed', 'Your Brightloop account is closed. Your billing history remains securely linked to your customer record.'],
  '404': ['We can’t find that page', 'The address may have changed, or the page may no longer be available.'],
  '500': ['Something went wrong', 'The application could not complete that request. Please try again later.']
};
export default function StatusPage({ code = '404' }) {
  const [title, message] = content[code] || content['404'];
  return <main className="status-page"><Link className="public-brand" to="/"><span className="public-brand-mark">b</span>brightloop</Link><div><span className="status-code">{code === 'session' ? 'SESSION' : code}</span><h1>{title}</h1><p>{message}</p><div className="status-actions"><Link className="button" to={code === 'session' ? '/login' : '/'}>{code === 'session' ? 'Sign in' : 'Back to Brightloop'}</Link>{code === '403' && <Link className="public-secondary" to="/app/dashboard">Go to dashboard</Link>}</div></div></main>;
}
