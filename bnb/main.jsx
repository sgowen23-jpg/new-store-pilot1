import React from 'react'
import { createRoot } from 'react-dom/client'
import Bnb from './Bnb.jsx'
import './bnb.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Bnb />
  </React.StrictMode>
)
