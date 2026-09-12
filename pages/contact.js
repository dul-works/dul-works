import Layout from '../components/Layout';
import ContactIcon from '../components/ContactIcon';
import Link from 'next/link';

export default function Contact() {
  const contacts = [
    {
      name: 'mail',
      src: `/assets/icons/mail.svg`,
      alt: 'Email',
      text: 'easyone.work@gmail.com',
      href: 'mailto:easyone.work@gmail.com',
      isLink: false
    },
    {
      name: 'instagram',
      src: `/assets/icons/instagram.svg`,
      alt: 'Instagram',
      text: 'https://www.instagram.com/easy_dul/',
      href: 'https://www.instagram.com/easy_dul/',
      isLink: true
    },
    {
      name: 'github',
      src: `/assets/icons/github.svg`,
      alt: 'GitHub',
      text: 'https://github.com/studio-edul',
      href: 'https://github.com/studio-edul',
      isLink: true
    },
  ];

  return (
    <Layout title="Portfolio - Contact">
      <div className="contact-container">
        <div className="contact-icons-column">
          {contacts.map((contact) => (
            <div key={contact.name} className="contact-icon-item">
              <ContactIcon src={contact.src} alt={contact.alt} />
            </div>
          ))}
        </div>
        <div className="contact-links-column">
          {contacts.map((contact) => (
            <div key={contact.name} className="contact-link-item">
              {contact.isLink ? (
                <Link href={contact.href} target="_blank" rel="noopener noreferrer" className="contact-link">
                  {contact.text}
                </Link>
              ) : (
                <a href={contact.href} className="contact-link">
                  {contact.text}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
