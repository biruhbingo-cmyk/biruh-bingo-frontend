import { type User, type Wallet } from '@/lib/api';

interface HeaderProps {
  user: User;
  wallet: Wallet;
}

export default function Header({ user, wallet }: HeaderProps) {
  const fullName = `${user.first_name} ${user.last_name || ''}`.trim();

  return (
    <div className="px-4 py-1 flex items-center justify-between">
      {/* Left: User Name */}
      <div className="flex items-center gap-3">
        <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
        </svg>
        <span className="text-white font-semibold text-lg">{fullName}</span>
      </div>

      {/* Right: Balance */}
      <div className="flex items-center gap-2 px-4 py-2 rounded-lg">
        <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
          <path d="M4 4a2 2 0 00-2 2v1a16.94 16.94 0 0012 6 16.94 16.94 0 0012-6V6a2 2 0 00-2-2H4z" />
          <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
        </svg>
        <span className="text-yellow-400 font-semibold text-lg">
          {wallet.balance.toFixed(2)} ETB
        </span>
      </div>
    </div>
  );
}

