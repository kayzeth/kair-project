import React from 'react';
import { Helmet } from 'react-helmet-async';

const Title = ({ page }) => {
  const baseTitle = 'Kairos';
  const title = page ? `${page} - ${baseTitle}` : baseTitle;

  return (
    <Helmet>
      <title>{title}</title>
    </Helmet>
  );
};

export default Title;
