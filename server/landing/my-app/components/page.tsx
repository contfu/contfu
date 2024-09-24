'use client'

import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, Database, Layers, Zap, ChevronLeft, ChevronRight, Moon, Sun } from "lucide-react"
import { useState, useEffect } from "react"

export function Page() {
  const [currentTestimonial, setCurrentTestimonial] = useState(0)
  const [darkMode, setDarkMode] = useState(false)

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  const testimonials = [
    {
      name: "Sarah Johnson",
      role: "Content Manager at TechCorp",
      image: "/placeholder.svg?height=100&width=100",
      quote: "contfu has revolutionized our content management process. We've cut our publishing time in half!",
    },
    {
      name: "Michael Chen",
      role: "Digital Marketing Director at GrowthCo",
      image: "/placeholder.svg?height=100&width=100",
      quote: "The unified dashboard is a game-changer. I can finally see all our content in one place.",
    },
    {
      name: "Emily Rodriguez",
      role: "CEO of ContentMasters",
      image: "/placeholder.svg?height=100&width=100",
      quote: "contfu's seamless integration with multiple CMS platforms has streamlined our entire workflow.",
    },
  ]

  const nextTestimonial = () => {
    setCurrentTestimonial((prev) => (prev + 1) % testimonials.length)
  }

  const prevTestimonial = () => {
    setCurrentTestimonial((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }

  return (
    <div className="flex flex-col min-h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="px-4 lg:px-6 h-14 flex items-center bg-[#4A6FA5] text-white">
        <Link className="flex items-center justify-center" href="#">
          <Database className="h-6 w-6" />
          <span className="ml-2 text-2xl font-bold">contfu</span>
        </Link>
        <nav className="ml-auto flex gap-4 sm:gap-6">
          <Link className="text-sm font-medium hover:underline underline-offset-4" href="#features">
            Features
          </Link>
          <Link className="text-sm font-medium hover:underline underline-offset-4" href="#how-it-works">
            How It Works
          </Link>
          <Link className="text-sm font-medium hover:underline underline-offset-4" href="#pricing">
            Pricing
          </Link>
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </nav>
      </header>
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-48 bg-[#4A6FA5] text-white">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none">
                  Unify Your Content with contfu
                </h1>
                <p className="mx-auto max-w-[700px] text-gray-200 md:text-xl">
                  Centralize and manage content from multiple CMS services in one powerful platform.
                </p>
              </div>
              <div className="space-x-4">
                <Button className="bg-[#FF69B4] text-white hover:bg-[#FF1493]">Get Started</Button>
                <Button variant="outline" className="border-white text-white hover:bg-white hover:text-[#4A6FA5] bg-transparent">Learn More</Button>
              </div>
            </div>
          </div>
        </section>
        <section id="features" className="w-full py-12 md:py-24 lg:py-32 bg-gray-100 dark:bg-gray-800">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-center mb-8 text-[#4A6FA5] dark:text-white">
              Key Features
            </h2>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <Card className="dark:bg-gray-700">
                <CardHeader>
                  <Layers className="h-8 w-8 mb-2 text-[#4A6FA5] dark:text-[#FF69B4]" />
                  <CardTitle className="text-[#4A6FA5] dark:text-white">Unified Dashboard</CardTitle>
                </CardHeader>
                <CardContent className="dark:text-gray-300">
                  Access content from all your CMS services in one centralized location.
                </CardContent>
              </Card>
              <Card className="dark:bg-gray-700">
                <CardHeader>
                  <Zap className="h-8 w-8 mb-2 text-[#4A6FA5] dark:text-[#FF69B4]" />
                  <CardTitle className="text-[#4A6FA5] dark:text-white">Seamless Integration</CardTitle>
                </CardHeader>
                <CardContent className="dark:text-gray-300">
                  Easily connect and sync with popular CMS platforms with just a few clicks.
                </CardContent>
              </Card>
              <Card className="dark:bg-gray-700">
                <CardHeader>
                  <CheckCircle className="h-8 w-8 mb-2 text-[#4A6FA5] dark:text-[#FF69B4]" />
                  <CardTitle className="text-[#4A6FA5] dark:text-white">Content Consistency</CardTitle>
                </CardHeader>
                <CardContent className="dark:text-gray-300">
                  Ensure brand consistency across all your content channels effortlessly.
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
        <section id="how-it-works" className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-center mb-8 text-[#4A6FA5] dark:text-white">
              How It Works
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              <div className="flex flex-col items-center text-center">
                <div className="rounded-full bg-[#4A6FA5] text-white w-12 h-12 flex items-center justify-center mb-4">1</div>
                <h3 className="text-xl font-bold mb-2 text-[#4A6FA5] dark:text-white">Connect</h3>
                <p className="text-gray-600 dark:text-gray-300">Link your CMS accounts to contfu</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="rounded-full bg-[#4A6FA5] text-white w-12 h-12 flex items-center justify-center mb-4">2</div>
                <h3 className="text-xl font-bold mb-2 text-[#4A6FA5] dark:text-white">Centralize</h3>
                <p className="text-gray-600 dark:text-gray-300">View all your content in one dashboard</p>
              </div>
              <div className="flex flex-col items-center text-center">
                <div className="rounded-full bg-[#4A6FA5] text-white w-12 h-12 flex items-center justify-center mb-4">3</div>
                <h3 className="text-xl font-bold mb-2 text-[#4A6FA5] dark:text-white">Manage</h3>
                <p className="text-gray-600 dark:text-gray-300">Edit, publish, and analyze your content</p>
              </div>
            </div>
          </div>
        </section>
        <section id="pricing" className="w-full py-12 md:py-24 lg:py-32 bg-gray-100 dark:bg-gray-800">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-center mb-8 text-[#4A6FA5] dark:text-white">
              Simple, Transparent Pricing
            </h2>
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <Card className="dark:bg-gray-700">
                <CardHeader>
                  <CardTitle className="text-[#4A6FA5] dark:text-white">Starter</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold mb-2 text-[#4A6FA5] dark:text-[#FF69B4]">$29</div>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">per month</p>
                  <ul className="space-y-2">
                    <li className="flex items-center">
                      <CheckCircle className="h-5 w-5 mr-2 text-[#4A6FA5] dark:text-[#FF69B4]" />
                      <span className="dark:text-gray-300">Up to 3 CMS integrations</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-5 w-5 mr-2 text-[#4A6FA5] dark:text-[#FF69B4]" />
                      <span className="dark:text-gray-300">Basic analytics</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-5 w-5 mr-2 text-[#4A6FA5] dark:text-[#FF69B4]" />
                      <span className="dark:text-gray-300">5 team members</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
              <Card className="dark:bg-gray-700">
                <CardHeader>
                  <CardTitle className="text-[#4A6FA5] dark:text-white">Pro</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold mb-2 text-[#4A6FA5] dark:text-[#FF69B4]">$79</div>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">per month</p>
                  <ul className="space-y-2">
                    <li className="flex items-center">
                      <CheckCircle className="h-5 w-5 mr-2 text-[#4A6FA5] dark:text-[#FF69B4]" />
                      <span className="dark:text-gray-300">Unlimited CMS integrations</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-5 w-5 mr-2 text-[#4A6FA5] dark:text-[#FF69B4]" />
                      <span className="dark:text-gray-300">Advanced analytics</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-5 w-5 mr-2 text-[#4A6FA5] dark:text-[#FF69B4]" />
                      <span className="dark:text-gray-300">15 team members</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
              <Card className="dark:bg-gray-700">
                <CardHeader>
                  <CardTitle className="text-[#4A6FA5] dark:text-white">Enterprise</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold mb-2 text-[#4A6FA5] dark:text-[#FF69B4]">Custom</div>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">Contact us for pricing</p>
                  <ul className="space-y-2">
                    <li className="flex items-center">
                      <CheckCircle className="h-5 w-5 mr-2 text-[#4A6FA5] dark:text-[#FF69B4]" />
                      <span className="dark:text-gray-300">Custom integrations</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-5 w-5 mr-2 text-[#4A6FA5] dark:text-[#FF69B4]" />
                      <span className="dark:text-gray-300">Dedicated support</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-5 w-5 mr-2 text-[#4A6FA5] dark:text-[#FF69B4]" />
                      <span className="dark:text-gray-300">Unlimited team members</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32">
          <div className="container px-4 md:px-6">
            <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl text-center mb-8 text-[#4A6FA5] dark:text-white">
              What Our Customers Say
            </h2>
            <div className="relative max-w-3xl mx-auto">
              <div className="flex flex-col items-center text-center">
                <Image
                  src={testimonials[currentTestimonial].image}
                  alt={testimonials[currentTestimonial].name}
                  width={100}
                  height={100}
                  className="rounded-full mb-4"
                />
                <blockquote className="text-xl italic mb-4 text-gray-700 dark:text-gray-300">
                  "{testimonials[currentTestimonial].quote}"
                </blockquote>
                <cite className="font-bold text-[#4A6FA5] dark:text-[#FF69B4]">{testimonials[currentTestimonial].name}</cite>
                <p className="text-sm text-gray-600 dark:text-gray-400">{testimonials[currentTestimonial].role}</p>
              </div>
              <button
                onClick={prevTestimonial}
                className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-white dark:bg-gray-800 rounded-full p-2 shadow-md text-[#4A6FA5] dark:text-[#FF69B4] hover:text-[#FF69B4] dark:hover:text-white"
                aria-label="Previous testimonial"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                onClick={nextTestimonial}
                className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-white dark:bg-gray-800 rounded-full p-2 shadow-md text-[#4A6FA5] dark:text-[#FF69B4] hover:text-[#FF69B4] dark:hover:text-white"
                aria-label="Next testimonial"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-[#4A6FA5] text-white">
          <div className="container px-4 md:px-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl">
                  Ready to Unify Your Content?
                </h2>
                <p className="mx-auto max-w-[700px] text-gray-200 md:text-xl">
                  Start your 14-day free trial today. No credit card required.
                </p>
              </div>
              <div className="w-full max-w-sm space-y-2">
                <form className="flex space-x-2">
                  <Input className="max-w-lg flex-1 bg-white text-gray-900 dark:bg-gray-700 dark:text-white" placeholder="Enter your email" type="email" />
                  <Button type="submit" className="bg-[#FF69B4] text-white hover:bg-[#FF1493]">Get Started</Button>
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="flex flex-col gap-2 sm:flex-row py-6 w-full shrink-0 items-center px-4 md:px-6 border-t bg-gray-100 dark:bg-gray-800 dark:border-gray-700">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          © 2023 contfu. All rights reserved.
        </p>
        <nav className="sm:ml-auto flex gap-4 sm:gap-6">
          <Link className="text-xs hover:underline underline-offset-4 text-gray-600 dark:text-gray-400" href="#">
            Terms of Service
          </Link>
          <Link className="text-xs hover:underline underline-offset-4 text-gray-600 dark:text-gray-400" href="#">
            Privacy
          </Link>
        </nav>
      </footer>
    </div>
  )
}