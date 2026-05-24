'use client';

import { Check, ChevronDown, Sparkles } from 'lucide-react';
import { memo, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { setSelectedModel } from '@/hooks/use-selected-model';
import { getCatalogModel, getFreeModels, getProModels } from '@/lib/ai/model-catalog';
import { cn } from '@/lib/utils';
import { useChatContext } from './chat-context';
import { ProModal } from './pro-modal';

const freeModels = getFreeModels();
const proModels = getProModels();

export const ModelSelector = memo(function ModelSelector() {
  const { state, dispatch } = useChatContext();
  const [proModalOpen, setProModalOpen] = useState(false);
  const [proModalModel, setProModalModel] = useState<string>();

  const selected = state.selectedModel;
  const catalogModel = getCatalogModel(selected);
  const displayName = catalogModel?.name ?? (selected === 'auto' ? 'Auto' : selected);

  function handleSelect(modelId: string) {
    dispatch({ type: 'SET_SELECTED_MODEL', model: modelId });
    setSelectedModel(modelId);
  }

  function handleProClick(modelName: string) {
    setProModalModel(modelName);
    setProModalOpen(true);
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-full px-2.5 h-8 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors border border-border/30"
          >
            <Sparkles className="h-3 w-3 text-primary" />
            <span className="max-w-[120px] truncate">{displayName}</span>
            <ChevronDown className="h-3 w-3 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="glass-panel border-border/30 shadow-2xl rounded-2xl min-w-64 mt-2 p-2"
        >
          {/* Auto option */}
          <DropdownMenuItem
            className="rounded-xl px-3 py-2 cursor-pointer transition-colors"
            onClick={() => handleSelect('auto')}
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="font-medium">Auto</span>
                <span className="text-muted-foreground text-xs">Best available</span>
              </div>
              {selected === 'auto' && <Check className="h-3.5 w-3.5 text-primary" />}
            </div>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="bg-border/20 my-1" />

          {/* Free models */}
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground px-3 py-1.5 font-medium">
              Free Models
            </DropdownMenuLabel>
            {freeModels.map((model) => (
              <DropdownMenuItem
                key={model.id}
                className={cn(
                  'rounded-xl px-3 py-2 cursor-pointer transition-colors',
                  selected === model.id && 'bg-primary/10'
                )}
                onClick={() => handleSelect(model.id)}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{model.name}</span>
                    <span className="text-muted-foreground text-xs">{model.description}</span>
                  </div>
                  {selected === model.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>

          <DropdownMenuSeparator className="bg-border/20 my-1" />

          {/* Pro models */}
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground px-3 py-1.5 font-medium">
              Pro Models
            </DropdownMenuLabel>
            {proModels.map((model) => (
              <DropdownMenuItem
                key={model.id}
                className="rounded-xl px-3 py-2 cursor-pointer transition-colors"
                onClick={() => handleProClick(model.name)}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm">{model.name}</span>
                      <Badge variant="info" className="text-[9px] px-1.5 py-0 h-4 leading-none">
                        PRO
                      </Badge>
                    </div>
                    <span className="text-muted-foreground text-xs">{model.description}</span>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <ProModal open={proModalOpen} onOpenChange={setProModalOpen} modelName={proModalModel} />
    </>
  );
});
