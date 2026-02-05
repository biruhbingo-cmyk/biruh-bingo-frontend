'use client';

export default function InstructionPage() {
  return (
    <main className="min-h-screen bg-blue-600 text-white">
      <div className="max-w-4xl mx-auto px-4 py-6 sm:py-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-center mb-6 sm:mb-8 text-yellow-300">
          መመሪያዎች
        </h1>

        <div className="space-y-6 sm:space-y-8">
          {/* Deposit Process */}
          <section className="bg-blue-500 rounded-lg p-4 sm:p-6 border border-blue-400 shadow-lg">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 text-yellow-300 flex items-center gap-2">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path d="M4 4a2 2 0 00-2 2v1a16.94 16.94 0 0012 6 16.94 16.94 0 0012-6V6a2 2 0 00-2-2H4z" />
                <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
              </svg>
              የገንዘብ ማስገቢያ ሂደት (በ6 ቅደም ተከተሎች)
            </h2>
            <ol className="space-y-3 list-decimal list-inside">
              <li className="pl-2">
                <strong>መጀመሪያ፦</strong> <code className="bg-blue-600 px-2 py-1 rounded">/deposit</code> ብለው ይፃፉ።
              </li>
              <li className="pl-2">
                <strong>የክፍያ መንገድ ይምረጡ፦</strong> በቴሌብር (Telebirr) ወይም በኢትዮጵያ ንግድ ባንክ (CBE)።
              </li>
              <li className="pl-2">
                <strong>መጠን ያስገቡ፦</strong> ከ50 እስከ 1,000 ብር።
              </li>
              <li className="pl-2">
                <strong>ክፍያ ይፈጽሙ፦</strong> በተሰጠው የሂሳብ ቁጥር ላይ ገንዘቡን ያስተላልፉ።
              </li>
              <li className="pl-2">
                <strong>የግብይት መለያ (Transaction ID) ያስገቡ፦</strong> በትክክል ኮፒ አድርገው ይለጥፉ።
              </li>
              <li className="pl-2">
                <strong>ይጠብቁ፦</strong> በአስተዳዳሪው ሲረጋገጥ ቀሪ ሂሳብዎ ይታደሳል።
              </li>
            </ol>
          </section>

          {/* Withdrawal Process */}
          <section className="bg-blue-500 rounded-lg p-4 sm:p-6 border border-blue-400 shadow-lg">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 text-yellow-300 flex items-center gap-2">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
              </svg>
              የገንዘብ ማውጫ ሂደት (በ7 ቅደም ተከተሎች)
            </h2>
            <ol className="space-y-3 list-decimal list-inside">
              <li className="pl-2">
                <strong>መጀመሪያ፦</strong> <code className="bg-blue-600 px-2 py-1 rounded">/withdraw</code> ብለው ይፃፉ።
              </li>
              <li className="pl-2">
                <strong>የገንዘብ ማስገቢያ መጠን፦</strong> <span className="text-red-300 font-bold">አስፈላጊ!</span> ለመውጣት ቢያንስ አንድ ጊዜ ገንዘብ ማስገቢያ ማድረግ አለብዎት።
              </li>
              <li className="pl-2">
                <strong>የወጪ አይነት ይምረጡ፦</strong> በቴሌብር (Telebirr) ወይም በኢትዮጵያ ንግድ ባንክ (CBE)።
              </li>
              <li className="pl-2">
                <strong>የሂሳብ ቁጥር ያስገቡ፦</strong> ገንዘቡን ለመቀበል የሚፈልጉትን የሂሳብ ቁጥር ያስገቡ።
              </li>
              <li className="pl-2">
                <strong>መጠን ያስገቡ፦</strong> ዝቅተኛው 50 ብር፤ ከመውጣት በኋላ ቢያንስ 10 ብር ቀሪ ሂሳብ መቆየት አለበት።
              </li>
              <li className="pl-2">
                <strong>ማረጋገጫ፦</strong> የጠየቁት መጠን ወዲያውኑ ከቀሪ ሂሳብዎ ላይ ይቀነሳል።
              </li>
              <li className="pl-2">
                <strong>ይጠብቁ፦</strong> ጥያቄው በአስተዳዳሪው ተቀባይነት ካገኘ ገንዘቡ ይላክልዎታል፤ ውድቅ ከተደረገ ግን ወደ ሂሳብዎ ይመለሳል።
              </li>
            </ol>
          </section>

          {/* Transfer Process */}
          <section className="bg-blue-500 rounded-lg p-4 sm:p-6 border border-blue-400 shadow-lg">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 text-yellow-300 flex items-center gap-2">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
              </svg>
              የገንዘብ ማስተላለፊያ ሂደት (በ6 ቅደም ተከተሎች)
            </h2>
            <ol className="space-y-3 list-decimal list-inside">
              <li className="pl-2">
                <strong>መጀመሪያ፦</strong> <code className="bg-blue-600 px-2 py-1 rounded">/transfer</code> ብለው ይፃፉ።
              </li>
              <li className="pl-2">
                <strong>ቀሪ ሂሳብዎን ያረጋግጡ፦</strong> ቀሪ ሂሳብዎ በራስ-ሰር ይታያል።
              </li>
              <li className="pl-2">
                <strong>የተቀባዩን የሪፈራል ኮድ (Referral Code) ያስገቡ፦</strong> የጓደኛዎን ኮድ ይጠይቁ (የእርስዎን ለማግኘት <code className="bg-blue-600 px-2 py-1 rounded">/referal_code</code> ብለው ይፃፉ)።
              </li>
              <li className="pl-2">
                <strong>ተቀባዩን ያረጋግጡ፦</strong> ቦቱ የተቀባዩን ስም እና ስልክ ቁጥር ያሳየዎታል።
              </li>
              <li className="pl-2">
                <strong>መጠን ያስገቡ፦</strong> ሊያስተላልፉት የሚፈልጉት መጠን ከቀሪ ሂሳብዎ ያነሰ እና ከዜሮ በላይ መሆን አለበት።
              </li>
              <li className="pl-2">
                <strong>ማረጋገጫ፦</strong> ዝውውሩ ወዲያውኑ ይፈጸማል፤ ለሁለታችሁም የማሳወቂያ መልዕክት ይደርሳችኋል።
              </li>
            </ol>
          </section>

          {/* Bingo Game Instructions */}
          <section className="bg-blue-500 rounded-lg p-4 sm:p-6 border border-blue-400 shadow-lg">
            <h2 className="text-xl sm:text-2xl font-bold mb-4 text-yellow-300 flex items-center gap-2">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
              </svg>
              የቢንጎ ጨዋታ አጭር መመሪያ
            </h2>
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-lg mb-2 text-yellow-200">1. ጨዋታ ምርጫ</h3>
                <p className="pl-2">ከ G1–G7 ይምረጡ (ከ5–200 ብር)።</p>
                <p className="pl-2">በቂ ሂሳብ መኖርዎን እና የጨዋታውን ሁኔታ ያረጋግጡ።</p>
              </div>

              <div>
                <h3 className="font-bold text-lg mb-2 text-yellow-200">2. ካርድ ምርጫ</h3>
                <p className="pl-2">አረንጓዴ፦ የሚመረጥ | ቀይ፦ የተያዘ።</p>
                <p className="pl-2">ከ100 ካርዶች ውስጥ የሚወዱትን ይምረጡ።</p>
              </div>

              <div>
                <h3 className="font-bold text-lg mb-2 text-yellow-200">3. አጨዋወት</h3>
                <p className="pl-2">ቁጥሮች ሲጠሩ በካርድዎ ላይ ካሉ ይጫኑ (ምልክት ያድርጉ)።</p>
                <p className="pl-2">የመሃል ቁጥር (#) ሁልጊዜ ነጻ ስጦታ ነው።</p>
              </div>

              <div>
                <h3 className="font-bold text-lg mb-2 text-yellow-200">4. ቢንጎ ለማለት</h3>
                <p className="pl-2">5 ቁጥሮች በመስመር (አግድም፣ ቀጥ፣ ወይም ሰያፍ) ሲሞሉ "Bingo" ይጫኑ።</p>
                <p className="pl-2">ቀድሞ በትክክል የጠራ ተጫዋች ያሸንፋል።</p>
              </div>

              <div>
                <h3 className="font-bold text-lg mb-2 text-yellow-200">5. ሽልማት</h3>
                <p className="pl-2">አሸናፊው ተጫዋቾች በከፈሉት ድምር ልክ ሽልማቱን በቀጥታ ሂሳቡ ላይ ያገኛል።</p>
              </div>

              <div>
                <h3 className="font-bold text-lg mb-2 text-yellow-200">6. ዋና ቁልፎች</h3>
                <p className="pl-2"><span className="mr-2">🔄</span><strong>Refresh:</strong> መረጃ ለማደስ።</p>
                <p className="pl-2"><span className="mr-2">🚪</span><strong>Leave:</strong> ለመውጣት (ውርርድ አይመለስም)።</p>
              </div>

              <div>
                <p className="pl-2"><span className="mr-2">💡</span><strong>ምክር፦</strong> ቁጥሮችን በፍጥነት ይከታተሉ፤ ሳይሞሉ "Bingo" አይበሉ!</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

