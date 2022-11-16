import { useState, useEffect, useRef } from 'react';

function Dropdown({ render, className = '' }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    document.addEventListener('click', handleDocumentClick);
  
    return () => document.removeEventListener('click', handleDocumentClick);
  });

  const handleDocumentClick = e => {
    if (isOpen && !dropdownRef.current.contains(e.target)) {
      setIsOpen(false);
    }
  }

  return (
    <div className={className} ref={dropdownRef}>
      {render({
        isOpen,
        toggleOpen: () => setIsOpen(!isOpen)
      })}
    </div>
  );
}

export default Dropdown;
