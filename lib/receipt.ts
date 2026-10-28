/** Thermal receipt (58 / 80 mm): styles shared by the on-screen preview and the print window, and the print action. */
export type Paper='58'|'80';

/** Receipt paper styles. One source of truth: ReceiptSheet injects it for the preview, printReceipt writes it into the print window. */
export const receiptCss=(receiptPaper:Paper)=>{
 const paperWidth=receiptPaper==='58'?'58mm':'80mm';
 return `
  .premium-receipt{display:block;width:${paperWidth};max-width:${paperWidth};padding:${receiptPaper==='58'?'3mm':'4mm'};margin:0;background:#fff;color:#000;font-size:${receiptPaper==='58'?'8pt':'9pt'};overflow:hidden}
  .receipt-store-header{text-align:center;padding:1mm 0 2.5mm;border-bottom:.25mm dashed #555}.receipt-store-brand{font-size:${receiptPaper==='58'?'14pt':'16pt'};font-weight:900;letter-spacing:.04em;line-height:1.1}.receipt-store-address{margin-top:1.2mm;font-size:7pt;line-height:1.45;color:#222}.receipt-store-contact{margin-top:.8mm;font-size:6.5pt;color:#444}
  .receipt-document-title{text-align:center;font-size:7pt;font-weight:800;letter-spacing:.16em;padding:2.5mm 0 1.5mm}.receipt-transaction-info{display:grid;gap:1mm;padding-bottom:2mm;border-bottom:.2mm dashed #777}.receipt-info-row{display:flex;justify-content:space-between;gap:3mm;font-size:7pt}.receipt-info-row span{color:#444}.receipt-info-row b{text-align:right;font-size:7pt}.receipt-success{display:none}
  .receipt-items{margin-top:2mm;border:0}.receipt-items-head{display:flex;justify-content:space-between;padding:1.5mm 0;border-bottom:.25mm solid #000}.receipt-items-head span{font-size:8pt;font-weight:800}.receipt-items-head small{font-size:7pt;color:#333}.receipt-item-list{padding:0}.receipt-item{display:flex;justify-content:space-between;align-items:flex-start;gap:3mm;padding:2mm 0;border-bottom:.2mm dashed #999;break-inside:avoid}.receipt-item-info{min-width:0;display:grid;gap:1mm}.receipt-item-info b{font-size:8pt;white-space:normal;overflow:visible}.receipt-item-info small{font-size:7pt;color:#333}.receipt-item>strong{font-size:8pt;white-space:nowrap}
  .receipt-totals{margin-top:2mm;padding:1.5mm 0;border-top:.25mm solid #000;border-bottom:.25mm solid #000}.receipt-total-row{display:flex;justify-content:space-between;gap:3mm;padding:1mm 0;font-size:8pt}.receipt-total-row.grand{padding-top:2mm;font-size:10pt;font-weight:900}.receipt-total-row.grand b{font-size:${receiptPaper==='58'?'12pt':'14pt'}}.receipt-payment-detail{margin-top:2mm;display:grid;gap:1mm;padding-bottom:2mm;border-bottom:.2mm dashed #777}.receipt-payment-detail .receipt-info-row{font-size:7pt}
  .receipt-footer{text-align:center;padding-top:3mm;display:grid;gap:1.2mm}.receipt-footer b{font-size:8pt}.receipt-footer span{font-size:7pt;line-height:1.45;color:#222}.receipt-footer small{font-size:6pt;color:#555}
 `;
};

/** Opens a clean window that holds only the receipt and prints it; falls back to window.print() (the @media print block in globals.css) when the popup is blocked. */
export function printReceipt(receiptPaper:Paper,orderNumber:string){
 const receiptNode=document.querySelector(`.premium-receipt.thermal-${receiptPaper}`) as HTMLElement|null;
 if(!receiptNode){window.print();return;}
 const paperWidth=receiptPaper==='58'?'58mm':'80mm';
 const printWindow=window.open('', '_blank');
 if(!printWindow){window.print();return;}
 printWindow.document.open();
 printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Struk ${orderNumber}</title><style>
  @page{size:${paperWidth} auto;margin:0}
  *{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000;font-family:Arial,Helvetica,sans-serif}body{width:${paperWidth};max-width:${paperWidth}}
${receiptCss(receiptPaper)}
 </style></head><body>${receiptNode.outerHTML}</body></html>`);
 printWindow.document.close();
 const startPrint=()=>{printWindow.focus();setTimeout(()=>printWindow.print(),250)};
 if(printWindow.document.readyState==='complete')setTimeout(startPrint,120);else printWindow.onload=startPrint;
}
