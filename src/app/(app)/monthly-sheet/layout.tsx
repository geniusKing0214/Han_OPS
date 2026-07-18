export default function MonthlySheetLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="w-full lg:relative lg:left-1/2 lg:w-[min(calc(100vw-15rem),1520px)] lg:max-w-none lg:-translate-x-1/2">
      {children}
    </div>
  );
}
