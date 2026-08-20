import { Music2, ReceiptText, ShieldCheck, Sparkles } from 'lucide-react'
import { aboutContent } from '../content/about'

const sectionIcons = [Music2, ReceiptText, ShieldCheck]

export function About() {
  return (
    <div className="page about-page">
      <header className="page-header page-header--hero">
        <div>
          <p className="eyebrow">{aboutContent.eyebrow}</p>
          <h1>{aboutContent.title}</h1>
          <p>{aboutContent.intro}</p>
        </div>
      </header>

      <section className="about-grid" aria-label={aboutContent.sectionsLabel}>
        {aboutContent.sections.map((section, index) => {
          const Icon = sectionIcons[index % sectionIcons.length]
          return (
            <article className="surface about-card" key={section.title}>
              <span className="about-card__icon"><Icon aria-hidden="true" /></span>
              <h2>{section.title}</h2>
              <p>{section.body}</p>
            </article>
          )
        })}
      </section>

      <aside className="surface about-closing">
        <span><Sparkles aria-hidden="true" /></span>
        <div>
          <h2>{aboutContent.closing.title}</h2>
          <p>{aboutContent.closing.body}</p>
        </div>
      </aside>
    </div>
  )
}
