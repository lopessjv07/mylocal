import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MyLibrary Cloud — Sua Nuvem Pessoal de Arquivos e Documentos',
  description:
    'Armazenamento em nuvem privado com organização em pastas, visualização de documentos e controle de acesso.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

