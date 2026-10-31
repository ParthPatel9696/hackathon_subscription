const PDFDocument = require('pdfkit');

const { formatCurrency, fromMinor, invoiceOutstandingMinor } = require('../utils/money');
// Standard PDF fonts do not contain the rupee glyph. Explicit INR text keeps
// exported amounts readable and searchable without requiring host-installed fonts.
const money = (amount) => formatCurrency(Number(amount) || 0, { code: true });
const date = (value) => value ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(new Date(value)) : '—';

function renderInvoicePdf(invoice, { title = 'INVOICE', validUntilLabel = 'Due date', totalLabel = 'Invoice total' } = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48, bufferPages: true });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('error', reject);
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    const left = 48;
    const right = 547;
    const company = invoice.companySnapshot || {};
    const address = invoice.billingAddressSnapshot || {};
    const customerAddress = [address.line1, address.line2, [address.city, address.state, address.postalCode].filter(Boolean).join(', '), address.country].filter(Boolean).join('\n');

    doc.fillColor('#166b5b').font('Helvetica-Bold').fontSize(23).text(company.displayName || company.name || 'Brightloop', left, 48, { width: 300 });
    doc.fillColor('#25312c').fontSize(19).text(title, 390, 48, { width: 157, align: 'right' });
    doc.moveDown(0.5).font('Helvetica').fontSize(9).fillColor('#66736c');
    const companyDetails = [company.legalName && company.legalName !== (company.displayName || company.name) ? company.legalName : '', company.address, company.email, company.phone, company.taxId ? `Tax ID: ${company.taxId}` : ''].filter(Boolean).join('\n');
    if (companyDetails) doc.text(companyDetails, left, 83, { width: 280, lineGap: 2 });
    doc.fillColor('#34413a').font('Helvetica-Bold').fontSize(10).text(invoice.invoiceNumber, 365, 83, { width: 182, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor('#66736c').text(`Status: ${invoice.status}`, 365, 101, { width: 182, align: 'right' });
    doc.text(`Invoice date: ${date(invoice.invoiceDate)}`, 365, 116, { width: 182, align: 'right' });
    doc.text(`${validUntilLabel}: ${date(invoice.dueDate)}`, 365, 131, { width: 182, align: 'right' });

    let y = 180;
    doc.fillColor('#25312c').font('Helvetica-Bold').fontSize(10).text('BILL TO', left, y);
    y += 18;
    doc.font('Helvetica-Bold').fontSize(10).text(address.name || invoice.customerName, left, y);
    y += 15;
    doc.font('Helvetica').fontSize(9).fillColor('#66736c').text(invoice.customerEmail, left, y);
    if (customerAddress) doc.text(customerAddress, left, y + 14, { width: 280, lineGap: 2 });
    if (address.taxId) doc.text(`Tax ID: ${address.taxId}`, left, y + 54, { width: 280 });
    doc.font('Helvetica-Bold').fillColor('#25312c').fontSize(9).text(`Subscription: ${invoice.subscriptionNumber}`, 365, 180, { width: 182, align: 'right' });
    if (invoice.billingPeriodStart || invoice.billingPeriodEnd) doc.font('Helvetica').fillColor('#66736c').text(`Billing period: ${date(invoice.billingPeriodStart)} – ${date(invoice.billingPeriodEnd)}`, 330, 198, { width: 217, align: 'right' });

    y = 265;
    const columns = { description: left, quantity: 248, price: 288, tax: 386, total: 444 };
    const drawTableHeader = () => {
      doc.rect(left, y, right - left, 24).fill('#edf3ef');
      doc.fillColor('#34413a').font('Helvetica-Bold').fontSize(8);
      doc.text('DESCRIPTION', columns.description + 7, y + 8, { width: 185 });
      doc.text('QTY', columns.quantity, y + 8, { width: 30, align: 'right' });
      doc.text('UNIT', columns.price, y + 8, { width: 88, align: 'right' });
      doc.text('TAX', columns.tax, y + 8, { width: 40, align: 'right' });
      doc.text('TOTAL', columns.total, y + 8, { width: 103, align: 'right' });
      y += 24;
    };
    drawTableHeader();
    for (const line of invoice.lines || []) {
      const description = [line.productName, line.variantName].filter(Boolean).join(' · ');
      doc.font('Helvetica').fontSize(9);
      const descriptionHeight = doc.heightOfString(description || 'Item', { width: 185 });
      const rowHeight = Math.max(28, descriptionHeight + 14);
      if (y + rowHeight > 735) { doc.addPage(); y = 48; drawTableHeader(); }
      doc.fillColor('#34413a').font('Helvetica').fontSize(9).text(description || 'Item', columns.description + 7, y + 9, { width: 185 });
      doc.text(String(line.quantity), columns.quantity, y + 9, { width: 30, align: 'right' });
      doc.fontSize(8).text(money(line.unitPrice), columns.price, y + 9, { width: 88, align: 'right' });
      doc.text(`${(Number(line.taxRate || 0) * 100).toFixed(1)}%`, columns.tax, y + 9, { width: 40, align: 'right' });
      doc.text(money(line.total), columns.total, y + 9, { width: 103, align: 'right' });
      y += rowHeight;
      doc.moveTo(left, y).lineTo(right, y).strokeColor('#e7ece8').stroke();
    }
    y += 14;
    if (y > 680) { doc.addPage(); y = 48; }
    const totals = [
      ['Subtotal', invoice.subtotal],
      ...(Number(invoice.discountTotal) > 0 ? [['Discount', -Number(invoice.discountTotal)]] : []),
      ['Tax', invoice.taxTotal]
    ];
    for (const [label, amount] of totals) {
      doc.fillColor('#66736c').font('Helvetica').fontSize(9).text(label, 315, y, { width: 100, align: 'right' });
      doc.fillColor('#34413a').text(money(amount), 425, y, { width: 122, align: 'right' });
      y += 17;
    }
    doc.moveTo(365, y).lineTo(right, y).strokeColor('#cbd8cf').stroke();
    y += 10;
    doc.fillColor('#166b5b').font('Helvetica-Bold').fontSize(10).text(totalLabel, 285, y, { width: 130, align: 'right' });
    doc.text(money(invoice.grandTotal), 425, y, { width: 122, align: 'right' });
    y += 28;
    if (title === 'INVOICE') {
      doc.font('Helvetica').fontSize(9).fillColor('#34413a').text(`Paid: ${money(invoice.paidAmount || 0)} | Balance due: ${money(fromMinor(invoiceOutstandingMinor(invoice)))}`, left, y, { width: right - left, align: 'right' });
      y += 22;
    }
    if (invoice.paymentTerms) doc.fillColor('#66736c').font('Helvetica').fontSize(8).text(`Payment terms: ${invoice.paymentTerms}`, left, y);
    doc.end();
  });
}

module.exports = { renderInvoicePdf };
