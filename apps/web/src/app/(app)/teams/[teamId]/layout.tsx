import { TeamPageHeader } from "./TeamPageHeader"

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TeamPageHeader />
      {children}
    </>
  )
}
