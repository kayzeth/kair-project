import React from 'react';
import './styles/tooltip.css';

const Tooltip = ({ text, children }) => {
  return (
    <div className="tooltip-container">
      {children}
      <div className="tooltip">{text}</div>
    </div>
  );
};

export default Tooltip;
