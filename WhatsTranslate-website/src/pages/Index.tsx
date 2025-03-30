
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, Download, ArrowRight, Check, Globe, Zap, Lock } from "lucide-react";

const Index = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [translatedText, setTranslatedText] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Animation on scroll
  useEffect(() => {
    const handleScroll = () => {
      setIsVisible(true);
    };
    
    window.addEventListener("scroll", handleScroll);
    // Set visible after a short delay for initial animations
    const timer = setTimeout(() => setIsVisible(true), 500);
    
    return () => {
      window.removeEventListener("scroll", handleScroll);
      clearTimeout(timer);
    };
  }, []);

  // Demo translation effect
  useEffect(() => {
    const originalText = "¡Hola! ¿Cómo estás?";
    const translatedFinal = "Hello! How are you?";
    
    if (translatedText === translatedFinal) return;
    
    const timer = setTimeout(() => {
      if (currentIndex < translatedFinal.length) {
        setTranslatedText(translatedFinal.substring(0, currentIndex + 1));
        setCurrentIndex(currentIndex + 1);
      }
    }, 50);
    
    return () => clearTimeout(timer);
  }, [translatedText, currentIndex]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <nav className="w-full py-4 px-6 md:px-12 flex justify-between items-center bg-whatsapp-lighter/90 backdrop-blur-sm fixed top-0 z-30 border-b border-whatsapp-light">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-whatsapp" />
          <span className="font-display font-bold text-xl text-whatsapp-dark">WhatsTranslate</span>
        </div>
        <div className="hidden md:flex items-center gap-6">
          <a href="#features" className="text-whatsapp-teal hover:text-whatsapp transition-colors">Features</a>
          <a href="#how-it-works" className="text-whatsapp-teal hover:text-whatsapp transition-colors">How It Works</a>
          <a href="#testimonials" className="text-whatsapp-teal hover:text-whatsapp transition-colors">Testimonials</a>
        </div>
        <Button className="rounded-full bg-whatsapp hover:bg-whatsapp-dark">Get Started</Button>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-6 md:px-12 bg-gradient-to-b from-whatsapp-lighter to-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-12">
          <div className="flex-1 space-y-6">
            <h1 className="text-4xl md:text-6xl font-display font-bold leading-tight">
              Chat Without <span className="text-gradient">Language Barriers</span>
            </h1>
            <p className="text-lg text-whatsapp-teal max-w-lg">
              Instantly translate your WhatsApp messages in real-time. Connect with anyone, anywhere, in any language.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Button size="lg" className="rounded-full bg-gradient-primary">
                <Download className="mr-2 h-5 w-5" /> Download Now
              </Button>
              <Button size="lg" variant="outline" className="rounded-full border-whatsapp text-whatsapp hover:bg-whatsapp-lighter">
                Learn More <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
          <div className="flex-1 flex justify-center">
            <div className="relative w-full max-w-md">
              <div className="absolute -left-8 -top-8 w-40 h-40 bg-whatsapp rounded-full filter blur-3xl opacity-20 animate-pulse"></div>
              <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-whatsapp-pastel rounded-full filter blur-3xl opacity-20 animate-pulse"></div>
              <div className={`bg-white rounded-3xl shadow-xl overflow-hidden border border-whatsapp-light z-10 relative ${isVisible ? 'bounce-in' : 'opacity-0'}`}>
                <div className="bg-whatsapp p-4">
                  <div className="flex items-center text-white">
                    <div className="w-3 h-3 rounded-full bg-white mr-2"></div>
                    <h3 className="font-medium">WhatsApp Chat</h3>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  <div className="chat-bubble-left">
                    ¡Hola! ¿Cómo estás?
                  </div>
                  <div className="text-xs text-whatsapp-dark/60 text-center">Translating...</div>
                  <div className="chat-bubble-right">
                    {translatedText}
                    {translatedText !== "Hello! How are you?" && <span className="animate-pulse">|</span>}
                  </div>
                  <div className="chat-bubble-left">
                    Espero que hayas tenido un buen día.
                  </div>
                  <div className="chat-bubble-right">
                    I hope you had a good day.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6 md:px-12 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4 text-whatsapp-dark">Amazing Features</h2>
            <p className="text-whatsapp-teal max-w-2xl mx-auto">Discover how our app makes communication effortless across any language</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className={`bg-white rounded-2xl p-6 shadow-lg border border-whatsapp-light hover:border-whatsapp/20 transition-all ${isVisible ? 'fade-in' : 'opacity-0'}`} style={{ animationDelay: '0.1s' }}>
              <div className="w-14 h-14 bg-whatsapp-lighter rounded-full flex items-center justify-center mb-6">
                <Globe className="h-7 w-7 text-whatsapp" />
              </div>
              <h3 className="text-xl font-display font-bold mb-3 text-whatsapp-dark">Universal Translation</h3>
              <p className="text-whatsapp-teal">Translate messages to and from multiple languages with incredible accuracy.</p>
            </div>
            
            {/* Feature 2 */}
            <div className={`bg-white rounded-2xl p-6 shadow-lg border border-whatsapp-light hover:border-whatsapp/20 transition-all ${isVisible ? 'fade-in' : 'opacity-0'}`} style={{ animationDelay: '0.2s' }}>
              <div className="w-14 h-14 bg-whatsapp-lighter rounded-full flex items-center justify-center mb-6">
                <Zap className="h-7 w-7 text-whatsapp" />
              </div>
              <h3 className="text-xl font-display font-bold mb-3 text-whatsapp-dark">Real-Time Translation</h3>
              <p className="text-whatsapp-teal">Messages are translated instantly, ensuring smooth and natural conversations.</p>
            </div>
            
            {/* Feature 3 */}
            <div className={`bg-white rounded-2xl p-6 shadow-lg border border-whatsapp-light hover:border-whatsapp/20 transition-all ${isVisible ? 'fade-in' : 'opacity-0'}`} style={{ animationDelay: '0.3s' }}>
              <div className="w-14 h-14 bg-whatsapp-lighter rounded-full flex items-center justify-center mb-6">
                <Lock className="h-7 w-7 text-whatsapp" />
              </div>
              <h3 className="text-xl font-display font-bold mb-3 text-whatsapp-dark">Private & Secure</h3>
              <p className="text-whatsapp-teal">Your conversations remain private with end-to-end encryption and no data storage.</p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-6 md:px-12 bg-gradient-to-b from-whatsapp-lighter to-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4 text-whatsapp-dark">How It Works</h2>
            <p className="text-whatsapp-teal max-w-2xl mx-auto">Three simple steps to start chatting in any language</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Line connector (desktop only) */}
            <div className="hidden md:block absolute h-0.5 bg-whatsapp-light top-1/4 left-[25%] right-[25%] z-0"></div>
            
            {/* Step 1 */}
            <div className={`relative z-10 ${isVisible ? 'fade-in' : 'opacity-0'}`} style={{ animationDelay: '0.2s' }}>
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-whatsapp-light text-center mb-4">
                <div className="w-12 h-12 rounded-full bg-whatsapp text-white flex items-center justify-center mx-auto mb-6 text-xl font-bold">1</div>
                <h3 className="text-xl font-display font-bold mb-3 text-whatsapp-dark">Download & Install</h3>
                <p className="text-whatsapp-teal">Get our app from the App Store or Google Play Store and install it on your device.</p>
              </div>
            </div>
            
            {/* Step 2 */}
            <div className={`relative z-10 ${isVisible ? 'fade-in' : 'opacity-0'}`} style={{ animationDelay: '0.4s' }}>
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-whatsapp-light text-center mb-4">
                <div className="w-12 h-12 rounded-full bg-whatsapp text-white flex items-center justify-center mx-auto mb-6 text-xl font-bold">2</div>
                <h3 className="text-xl font-display font-bold mb-3 text-whatsapp-dark">Connect to WhatsApp</h3>
                <p className="text-whatsapp-teal">Set up the app with your WhatsApp account using our secure connection process.</p>
              </div>
            </div>
            
            {/* Step 3 */}
            <div className={`relative z-10 ${isVisible ? 'fade-in' : 'opacity-0'}`} style={{ animationDelay: '0.6s' }}>
              <div className="bg-white rounded-2xl p-6 shadow-lg border border-whatsapp-light text-center mb-4">
                <div className="w-12 h-12 rounded-full bg-whatsapp text-white flex items-center justify-center mx-auto mb-6 text-xl font-bold">3</div>
                <h3 className="text-xl font-display font-bold mb-3 text-whatsapp-dark">Start Chatting</h3>
                <p className="text-whatsapp-teal">Begin sending and receiving messages that are automatically translated in real-time.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-20 px-6 md:px-12 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4 text-whatsapp-dark">What Our Users Say</h2>
            <p className="text-whatsapp-teal max-w-2xl mx-auto">Thousands of people are already breaking language barriers</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Testimonial 1 */}
            <div className={`bg-white rounded-2xl p-6 shadow-lg border border-whatsapp-light ${isVisible ? 'fade-in' : 'opacity-0'}`} style={{ animationDelay: '0.1s' }}>
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-whatsapp-lighter rounded-full flex items-center justify-center text-whatsapp-dark font-bold">SC</div>
                <div className="ml-4">
                  <h4 className="font-bold text-whatsapp-dark">Sarah C.</h4>
                  <p className="text-sm text-whatsapp-teal/70">Business Owner</p>
                </div>
              </div>
              <p className="text-whatsapp-teal italic">"This app changed my international business communications. I can now chat with my suppliers in China as easily as if we spoke the same language."</p>
              <div className="flex mt-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-whatsapp" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>
            
            {/* Testimonial 2 */}
            <div className={`bg-white rounded-2xl p-6 shadow-lg border border-whatsapp-light ${isVisible ? 'fade-in' : 'opacity-0'}`} style={{ animationDelay: '0.2s' }}>
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-whatsapp-lighter rounded-full flex items-center justify-center text-whatsapp-dark font-bold">MJ</div>
                <div className="ml-4">
                  <h4 className="font-bold text-whatsapp-dark">Miguel J.</h4>
                  <p className="text-sm text-whatsapp-teal/70">Exchange Student</p>
                </div>
              </div>
              <p className="text-whatsapp-teal italic">"As an exchange student, staying connected with family back home while making new friends here was challenging until I found this app. Now language is no longer a barrier!"</p>
              <div className="flex mt-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-whatsapp" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>
            
            {/* Testimonial 3 */}
            <div className={`bg-white rounded-2xl p-6 shadow-lg border border-whatsapp-light ${isVisible ? 'fade-in' : 'opacity-0'}`} style={{ animationDelay: '0.3s' }}>
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-whatsapp-lighter rounded-full flex items-center justify-center text-whatsapp-dark font-bold">AT</div>
                <div className="ml-4">
                  <h4 className="font-bold text-whatsapp-dark">Anita T.</h4>
                  <p className="text-sm text-whatsapp-teal/70">Travel Blogger</p>
                </div>
              </div>
              <p className="text-whatsapp-teal italic">"I travel to a new country every month for my blog. This app has become my must-have travel companion. I can chat with locals, arrange accommodations, and make friends anywhere!"</p>
              <div className="flex mt-4">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-whatsapp" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

            {/* CTA Section */}
            <section className="py-20 px-6 md:px-12 bg-gradient-to-r from-whatsapp-dark to-whatsapp text-white">
        <div className="max-w-6xl mx-auto text-center">
          <div className={`space-y-6 ${isVisible ? 'fade-in' : 'opacity-0'}`}>
            <h2 className="text-3xl md:text-5xl font-display font-bold leading-tight">Ready to Chat in Any Language?</h2>
            <p className="text-xl max-w-2xl mx-auto opacity-90">Download WhatsTranslate today and start connecting with people all around the world.</p>
            <div className="flex justify-center pt-6">
              <Button 
                size="lg" 
                className="rounded-full bg-white text-whatsapp hover:bg-whatsapp-lighter hover:text-whatsapp-dark"
                onClick={() => window.open('https://chrome.google.com/webstore', '_blank')}
              >
                <Download className="mr-2 h-5 w-5" /> Get Chrome Extension
              </Button>
            </div>
          </div>
        </div>
      </section>
    

      {/* Footer */}
      <footer className="py-12 px-6 md:px-12 bg-whatsapp-teal text-white/80">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <MessageSquare className="h-6 w-6 text-white" />
                <span className="font-display font-bold text-xl text-white">WhatsTranslate</span>
              </div>
              <p className="text-white/70">Breaking language barriers one message at a time.</p>
            </div>
            
            <div>
              <h4 className="font-bold text-white mb-4">Product</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-white transition-colors">FAQ</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-white mb-4">Company</h4>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Careers</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-bold text-white mb-4">Legal</h4>
              <ul className="space-y-2">
                <li><a href="#" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-white transition-colors">Cookie Policy</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-white/20 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
            <p>© 2023 WhatsTranslate. All rights reserved.</p>
            <div className="flex gap-4 mt-4 md:mt-0">
              <a href="#" className="hover:text-white transition-colors">
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
                </svg>
              </a>
              <a href="#" className="hover:text-white transition-colors">
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M8.29 20.251c7.547 0 11.675-6.253 11.675-11.675 0-.178 0-.355-.012-.53A8.348 8.348 0 0022 5.92a8.19 8.19 0 01-2.357.646 4.118 4.118 0 001.804-2.27 8.224 8.224 0 01-2.605.996 4.107 4.107 0 00-6.993 3.743 11.65 11.65 0 01-8.457-4.287 4.106 4.106 0 001.27 5.477A4.072 4.072 0 012.8 9.713v.052a4.105 4.105 0 003.292 4.022 4.095 4.095 0 01-1.853.07 4.108 4.108 0 003.834 2.85A8.233 8.233 0 012 18.407a11.616 11.616 0 006.29 1.84" />
                </svg>
              </a>
              <a href="#" className="hover:text-white transition-colors">
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
