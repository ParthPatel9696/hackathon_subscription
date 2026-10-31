import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AuthFrame({ title, subtitle, children }) {
  return <main className="auth-page"><div className="auth-aside"><Link className="public-brand" to="/"><span className="public-brand-mark">b</span>brightloop</Link><div className="auth-aside-copy"><p className="eyebrow">SUBSCRIPTION OPERATIONS</p><h2>Make recurring work<br /><em>feel more manageable.</em></h2><p>One workspace for customer subscriptions, billing, invoices, and payments.</p></div><span className="auth-aside-foot">BRIGHTLOOP WORKSPACE</span></div><section className="auth-main"><div className="auth-form-wrap"><Link className="auth-back" to="/"><ArrowLeft size={15}/> Back to Brightloop</Link><div className="auth-heading"><h1>{title}</h1><p>{subtitle}</p></div>{children}</div><span className="auth-legal">By continuing, you agree to the <Link to="/terms">terms</Link> and acknowledge the <Link to="/privacy">privacy notice</Link>.</span></section></main>;
}
