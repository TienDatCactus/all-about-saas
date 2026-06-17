import React from "react";
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Tailwind,
} from "react-email";
import Footer from "./footer";
import Header from "./header";
import { barebonesBoxedTailwindConfig } from "../styles/theme";
import { BarebonesFonts } from "../styles/fonts";

export default function EmailLayout({
  children,
  title,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Tailwind config={barebonesBoxedTailwindConfig}>
      <Html>
        <Head>
          <BarebonesFonts />
        </Head>
        <Body className="bg-bg-2 m-0 text-center font-sans">
          <Preview>{title}</Preview>
          <Container className="mobile:mt-0 mx-auto mt-8 w-full max-w-[640px]">
            <Header />
            <Section>
              <Section className="bg-bg mobile:px-2 px-6 py-4">
                {children}
              </Section>
            </Section>
            <Footer />
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}
