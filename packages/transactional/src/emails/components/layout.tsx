import React from "react";
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Tailwind,
  Text,
} from "react-email";
import { emailTailwindConfig } from "../../theme";
import { EmailFonts } from "../styles/fonts";
import { baseURL } from "../utils";
import EmailButton from "./button";

interface EmailLayoutProps {
  content: {
    title: string;
    subtitle: string;
    legend: string;
    brand?: string;
    cta: {
      text: string;
      url: string;
    };
  };
  image: {
    type: "logo" | "hero";
    src: string;
    alt?: string;
    size?: {
      width: number;
      height: number;
    };
  };
  children?: React.ReactNode;
}

const medias: {
  imageSrc: string;
  href: string;
}[] = [
  {
    imageSrc: `${baseURL}/icons/facebook.png`,
    href: "https://www.facebook.com/tdat.cactus",
  },
  {
    imageSrc: `${baseURL}/icons/linkedin.png`,
    href: "https://www.linkedin.com/in/tiendatcactus",
  },
  {
    imageSrc: `${baseURL}/icons/instagram.png`,
    href: "https://www.instagram.com/tien.dat_11",
  },
];

export default function EmailLayout({
  children,
  image,
  content,
}: EmailLayoutProps) {
  return (
    <Tailwind config={emailTailwindConfig}>
      <Html>
        <Head>
          <EmailFonts />
        </Head>
        <Body className="bg-canvas font-14 font-inter text-fg m-0 p-0">
          <Preview>{content.title}</Preview>
          <Container className="mx-auto max-w-[640px] px-4 pt-16 pb-6">
            <Section className="shadow-collage-card rounded-[8px]">
              <Section className="bg-bg border-stroke rounded-[8px] border overflow-hidden">
                {image && image.type == "hero" ? (
                  <Section className="p-0">
                    <Img
                      src={image.src}
                      alt={image?.alt}
                      width={image.size ? image.size.width : 608}
                      className={`block w-full max-w-[${image.size ? image.size.width : 608}] border-none`}
                    />
                  </Section>
                ) : (
                  <Section className="mobile:px-6! px-10 pt-16">
                    <Img
                      src={image.src}
                      alt={image?.alt}
                      width={image.size ? image.size.width : 148}
                      height={image.size ? image.size.width : 111}
                      className="block border-none"
                    />
                  </Section>
                )}
                <Section className="mobile:px-6! mobile:pt-6 px-10 pt-10 pb-14 text-left">
                  <Section className="mb-9 text-left">
                    <Text className="font-48 text-fg m-0 font-sans">
                      {content.title}
                    </Text>
                    <Text className="font-14 font-inter text-fg-2 m-0 mt-[18px]">
                      {content.subtitle}.
                    </Text>
                    <Text className="font-14 font-inter text-fg-2 m-0">
                      {content.legend}
                    </Text>
                  </Section>

                  {content.cta && (
                    <Section className="text-left">
                      <EmailButton
                        href={content.cta.url}
                        text={content.cta.text}
                      />
                    </Section>
                  )}
                </Section>
                {!!children && children}
                <Section className="border-stroke border-t px-10 py-16">
                  <Text className="font-13 font-inter text-fg-3 m-0 max-w-[320px]">
                    All About SaaS is the boilerplate and workspace where your
                    team keeps projects, context, and updates together—from
                    first idea to launch.
                  </Text>

                  <Row align="left">
                    <Column className="w-full align-top">
                      <Section align="left" className="mt-8 w-[152px]">
                        <Row align="left">
                          <Column className="w-[20px] pr-8">
                            <Link
                              href="https://example.com/"
                              className="inline-block"
                            >
                              <Img
                                src={`${baseURL}/static/shared/social-x-black.png`}
                                alt="X"
                                width={20}
                                height={20}
                                className="block border-none"
                              />
                            </Link>
                          </Column>
                          <Column className="w-[20px] pr-8">
                            <Link
                              href="https://example.com/"
                              className="inline-block"
                            >
                              <Img
                                src={`${baseURL}/static/shared/social-in-black.png`}
                                alt="LinkedIn"
                                width={20}
                                height={20}
                                className="block border-none"
                              />
                            </Link>
                          </Column>
                          <Column className="w-[20px] pr-8">
                            <Link
                              href="https://example.com/"
                              className="inline-block"
                            >
                              <Img
                                src={`${baseURL}/static/shared/social-yt-black.png`}
                                alt="YouTube"
                                width={20}
                                height={20}
                                className="block border-none"
                              />
                            </Link>
                          </Column>
                          <Column className="w-[20px]">
                            <Link
                              href="https://example.com/"
                              className="inline-block"
                            >
                              <Img
                                src={`${baseURL}/static/shared/social-gh-black.png`}
                                alt="GitHub"
                                width={20}
                                height={20}
                                className="block border-none"
                              />
                            </Link>
                          </Column>
                        </Row>
                      </Section>
                    </Column>
                  </Row>

                  <Row align="left">
                    <Column className="w-full pt-8 align-top">
                      <Text className="font-11 font-inter text-fg-2 m-0">
                        CT2 Ngo Thi Nham, Ha Cau, Ha Dong
                        <br />
                        Ha Noi, Viet Nam, 10000
                      </Text>
                    </Column>
                  </Row>
                </Section>
              </Section>
            </Section>
          </Container>
        </Body>
      </Html>
    </Tailwind>
  );
}
