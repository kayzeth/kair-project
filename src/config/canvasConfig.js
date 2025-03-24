// Canvas API Configuration
const isConfigured = () => {
  const token = localStorage.getItem('canvasToken');
  const domain = localStorage.getItem('canvasDomain');
  return !!(token && domain);
};

export { isConfigured };
