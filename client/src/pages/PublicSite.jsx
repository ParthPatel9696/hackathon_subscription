import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check, CreditCard, FileText, Layers3, LineChart, Menu, Package, Wallet } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const features = [
  ['Subscriptions', 'Follow contracts from quotation through activation, pause, and closure.', Layers3],
  ['Recurring billing', 'Generate invoices for subscriptions as they reach their billing dates.', CreditCard],
  ['Customer records', 'Keep account, subscription, invoice, and payment records together.', Package],
  ['Invoices and payments', 'Review invoice balances and record full or partial payments.', FileText],
  ['Discounts', 'Configure percentage or fixed discounts with usage and expiry rules.', Wallet],
  ['Reporting', 'Review recurring revenue, collections, and outstanding balances from live records.', LineChart]
];

export default function PublicSite() {
  const { pathname } = useLocation();
  if (pathname === '/about') return <AboutPage />;
  if (pathname === '/features') return <FeaturesPage />;
  if (pathname === '/pricing') return <PricingPage />;
  if (pathname === '/contact') return <ContactPage />;
  if (pathname === '/privacy') return <PolicyPage kind="privacy" />;
  if (pathname === '/terms') return <PolicyPage kind="terms" />;
  return <LandingPage />;
}

function PublicLayout({ children }) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    setMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.title = (pathname === '/' ? 'Subscriptions, invoices and payments' : pathname.slice(1).replace(/^./, (c) => c.toUpperCase())) + ' | Brightloop';
  }, [pathname]);
  useEffect(() => {
    const close = (event) => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, []);
  return <div className="public-site">
    <a className="skip-link" href="#public-main">Skip to content</a><header className="public-nav"><Link className="public-brand" to="/"><span className="public-brand-mark">b</span>brightloop</Link>
      <button type="button" className="public-menu-toggle icon-button" aria-label="Toggle navigation" aria-expanded={menuOpen} aria-controls="public-menu" onClick={() => setMenuOpen((open) => !open)}><Menu size={20} /></button><nav id="public-menu" className={menuOpen ? 'public-menu-open' : ''} aria-label="Public navigation"><Link to="/features">Product</Link><Link to="/pricing">Pricing</Link><Link to="/about">About</Link><Link to="/contact">Contact</Link></nav>
      <div className="public-nav-actions"><Link className="public-login" to="/login">Sign in</Link><Link className="public-cta small" to="/register">Get started <ArrowRight size={14} /></Link></div>
    </header><motion.main id="public-main" key={pathname} initial={{ opacity: 0, y: reducedMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>{children}</motion.main>
    <footer className="public-footer"><Link className="public-brand" to="/"><span className="public-brand-mark">b</span>brightloop</Link><span>Subscription operations, with the details in view.</span><nav aria-label="Footer"><Link to="/features">Product</Link><Link to="/pricing">Pricing</Link><Link to="/contact">Contact</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></nav></footer>
  </div>;
}

function LandingPage() {
  return <PublicLayout><section className="public-hero"><div className="public-hero-copy"><p className="eyebrow">SUBSCRIPTION OPERATIONS</p><h1>Recurring revenue,<br /><em>in good order.</em></h1><p className="hero-description">Keep subscriptions, billing, invoices, and customer payments moving together in one clear workspace.</p><div className="hero-actions"><Link className="public-cta" to="/register">Get started <ArrowRight size={16} /></Link><Link className="public-secondary" to="/features">Explore the product</Link></div><p className="hero-note">Built for the everyday work behind recurring revenue.</p></div>
    <ProductPreview /></section>
    <section className="public-section capability-section"><div className="section-heading"><p className="eyebrow">ONE CONNECTED WORKFLOW</p><h2>Run the full billing cycle<br />from one place.</h2></div><div className="capability-grid">{features.map(([title, body, Icon]) => <motion.article key={title} className="capability-item" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.25 }}><Icon size={18} strokeWidth={1.7} /><h3>{title}</h3><p>{body}</p></motion.article>)}</div></section>
    <section className="workflow-band"><div><p className="eyebrow">A CLEARER WAY TO WORK</p><h2>From a first quote<br />to a paid invoice.</h2></div><ol>{[['01','Set up products and plans'],['02','Prepare a customer quotation'],['03','Activate and manage subscriptions'],['04','Bill on schedule and reconcile payments']].map(([n,t])=><li key={n}><span>{n}</span>{t}<ArrowRight size={15} /></li>)}</ol></section>
    <section className="public-final-cta"><p className="eyebrow">BRIGHTLOOP WORKSPACE</p><h2>Bring your recurring work<br />into focus.</h2><Link className="public-cta" to="/register">Create an account <ArrowRight size={16} /></Link></section>
  </PublicLayout>;
}

function ProductPreview() {
  return <div className="product-preview" aria-label="Illustrative Brightloop application preview"><div className="preview-chrome"><div className="preview-logo"><i /> brightloop</div><span>WORKSPACE / OVERVIEW</span><div className="preview-avatar">BL</div></div><div className="preview-body"><aside><b>OVERVIEW</b><span className="preview-active">◈ &nbsp; Dashboard</span><span>Customers</span><span>Subscriptions</span><span>Invoices</span><span>Payments</span></aside><div className="preview-content"><div className="preview-title"><div><small>BUSINESS WORKSPACE</small><h3>Business overview</h3></div><span>Reporting period⌄</span></div><div className="preview-metrics"><div><small>MONTHLY RECURRING REVENUE</small><strong>—</strong><em>Live account data</em></div><div><small>ACTIVE SUBSCRIPTIONS</small><strong>—</strong><em>Current contracts</em></div><div><small>OUTSTANDING</small><strong>—</strong><em>Open invoice balance</em></div></div><div className="preview-lower"><div className="preview-chart"><small>SUBSCRIPTION LIFECYCLE</small>{['Draft','Quotation','Active','Paused'].map((status) => <p className="preview-status-row" key={status}><span>{status}</span><b>—</b></p>)}</div><div className="preview-list"><small>WORKSPACE AREAS</small><p><i/>Subscriptions</p><p><i/>Invoices</p><p><i/>Payments</p></div></div></div></div><div className="preview-caption"><Check size={13} /> Illustrative preview · workspace values come from your account</div></div>;
}

function FeaturesPage() {
  return <PublicLayout><section className="public-subpage"><p className="eyebrow">PRODUCT</p><h1>Every part of recurring<br />billing, connected.</h1><p className="subpage-lead">Brightloop brings the operational pieces of subscription revenue into one workflow.</p><div className="feature-detail-grid">{features.map(([title, body, Icon])=><article key={title}><Icon size={19}/><h2>{title}</h2><p>{body}</p></article>)}</div><Link className="public-cta" to="/register">Explore your workspace <ArrowRight size={16}/></Link></section></PublicLayout>;
}
function PricingPage() {
  return <PublicLayout><section className="public-subpage narrow"><p className="eyebrow">PRICING</p><h1>Pricing that fits<br />your operation.</h1><p className="subpage-lead">Brightloop’s commercial plans have not been configured yet. We won’t publish placeholder prices or promise features that aren’t part of the current product.</p><div className="pricing-note"><span>CONFIGURATION REQUIRED</span><p>Ask your Brightloop administrator to set the available plans, billing intervals, and included features before publishing pricing.</p></div><Link className="public-secondary" to="/contact">Contact Brightloop <ArrowRight size={15}/></Link></section></PublicLayout>;
}
function ContactPage() {
  return <PublicLayout><section className="public-subpage narrow"><p className="eyebrow">CONTACT</p><h1>Let’s get you<br />to the right place.</h1><p className="subpage-lead">For account, billing, or product questions, sign in to your Brightloop workspace and contact the administrator for your organization.</p><div className="pricing-note"><span>SUPPORT CHANNEL</span><p>A public support email has not been configured for this installation. Workspace administrators can provide the correct contact details.</p></div><Link className="public-cta" to="/login">Sign in to Brightloop <ArrowRight size={16}/></Link></section></PublicLayout>;
}
function PolicyPage({ kind }) {
  const privacy = kind === 'privacy';
  return <PublicLayout><article className="public-subpage policy-page"><p className="eyebrow">BRIGHTLOOP · {privacy ? 'PRIVACY' : 'TERMS'}</p><h1>{privacy ? 'Privacy notice' : 'Terms of use'}</h1><p className="subpage-lead">This document describes the current application at a high level and should be reviewed and completed by the organization operating this Brightloop installation.</p>
    {privacy ? <><h2>Information handled</h2><p>Brightloop stores account details such as name, email address, company name, and password credentials. Passwords are hashed by the server. Depending on use, the workspace also stores customer, product, subscription, invoice, payment, and discount records.</p><h2>Account and billing records</h2><p>Operational records are used to provide subscription management, recurring billing, payment reconciliation, and reporting. Invoice and payment details may be retained as part of the account’s business records.</p><h2>Authentication and security</h2><p>The application uses signed authentication tokens and an HTTP-only session cookie. Password reset requests create time-limited reset tokens. Administrators should protect the server, database, and signing secrets.</p><h2>Contact and retention</h2><p>The organization operating this installation controls its database and retention practices. Contact that organization for questions about access, correction, or deletion of account data.</p></> : <><h2>Using this workspace</h2><p>Access is provided by the organization operating this Brightloop installation. Users must protect their sign-in credentials and use the service only for authorized business purposes.</p><h2>Financial records</h2><p>Users are responsible for reviewing customer, subscription, invoice, and payment information entered into the workspace. Changes to historical financial records should follow the organization’s accounting policies.</p><h2>Availability and support</h2><p>The service is provided as configured by the operating organization. Support, commercial pricing, service levels, and data retention terms must be supplied by that organization.</p><h2>Organization-specific terms</h2><p>This editable notice is not a substitute for terms prepared for the organization’s jurisdiction and business model. The operator should review it before relying on it.</p></>}
  </article></PublicLayout>;
}

function AboutPage() {
  return <PublicLayout><section className="public-subpage narrow"><p className="eyebrow">ABOUT BRIGHTLOOP</p><h1>A clearer view of<br />recurring business.</h1><p className="subpage-lead">Brightloop connects the daily work of managing subscriptions: preparing quotations, billing on schedule, recording payments, and understanding what is still owed.</p><div className="pricing-note"><span>ONE SHARED WORKSPACE</span><p>Administrators configure the catalogue and billing policies. Staff manage day-to-day operations. Customers have a private view of their subscriptions, invoices, and payment history.</p></div><Link className="public-cta" to="/features">Explore the platform <ArrowRight size={16}/></Link></section></PublicLayout>;
}
