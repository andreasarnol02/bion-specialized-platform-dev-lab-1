const LOW_STOCK_THRESHOLD = 10;

function StockBadge({ stock }) {
  const count = Number(stock) || 0;

  if (count === 0) {
    return <span className="stock-badge out">Stok habis</span>;
  }

  if (count <= LOW_STOCK_THRESHOLD) {
    return <span className="stock-badge low">Stok menipis, sisa {count}</span>;
  }

  return <span className="stock-badge in">Stok tersedia</span>;
}

export default StockBadge;
