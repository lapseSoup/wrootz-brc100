'use client'

import MobileDrawer from './MobileDrawer'
import { useMobileMenu } from './MobileMenuProvider'

interface MobileSidebarProps {
  children: React.ReactNode
}

export default function MobileSidebar({ children }: MobileSidebarProps) {
  const { isOpen, close } = useMobileMenu()

  return (
    <MobileDrawer isOpen={isOpen} onClose={close}>
      {children}
    </MobileDrawer>
  )
}
